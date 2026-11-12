// ===== Client-Side Demo API & Role-Based Session Store for Vercel =====
// Intercepts /api/* requests in the browser using Indian seed data (TP_DEMO_SEED).
// All Add / Update / Delete operations update sessionStorage ('tp_demo_db') visually
// for the current login session, and reset cleanly back to seed data on logout.

(function () {
    const STORAGE_KEY = 'tp_demo_db';
    const nativeFetch = window.fetch.bind(window);

    function cloneSeed() {
        return JSON.parse(JSON.stringify(window.TP_DEMO_SEED));
    }

    function getDb() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {
            console.warn('Demo DB parse error, resetting to seed.', e);
        }
        const fresh = cloneSeed();
        saveDb(fresh);
        return fresh;
    }

    function saveDb(db) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (e) {
            console.warn('Unable to persist demo DB in sessionStorage.', e);
        }
    }

    window.resetDemoDb = function () {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    };

    function jsonResponse(payload, status = 200) {
        return new Response(JSON.stringify(payload), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function makeDemoToken(user) {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const body = btoa(JSON.stringify({
            sub: String(user.id),
            email: user.email,
            role: user.role,
            iat: Math.floor(Date.now() / 1000)
        }));
        return `${header}.${body}.demo-signature`;
    }

    function getAuthUser(options, db) {
        const headers = options && options.headers ? options.headers : {};
        let authHeader = '';
        if (headers instanceof Headers) {
            authHeader = headers.get('Authorization') || headers.get('authorization') || '';
        } else {
            authHeader = headers.Authorization || headers.authorization || '';
        }

        const token = authHeader.replace(/^Bearer\s+/i, '').trim() || localStorage.getItem('tp_token') || '';
        if (!token) return null;

        try {
            const parts = token.split('.');
            if (parts.length < 2) return null;
            const payload = JSON.parse(atob(parts[1]));
            const userId = parseInt(payload.sub, 10);
            return db.users.find(u => u.id === userId) || null;
        } catch (e) {
            return null;
        }
    }

    async function readJsonBody(options) {
        if (!options || !options.body) return {};
        if (typeof options.body === 'string') {
            try { return JSON.parse(options.body); } catch { return {}; }
        }
        return {};
    }

    function nextId(arr) {
        if (!arr || arr.length === 0) return 1;
        return Math.max(...arr.map(x => Number(x.id) || 0)) + 1;
    }

    function isMainAdmin(user) {
        return Boolean(user && user.role === 'Admin');
    }

    function isAdminOrSubAdmin(user) {
        return Boolean(user && (user.role === 'Admin' || user.role === 'SubAdmin'));
    }

    function buildStaffProfile(user, db) {
        const fallback = db.adminProfile || {};
        const isPrimaryAdmin = user.id === 1;
        return {
            fullName: isPrimaryAdmin ? (fallback.fullName || user.fullName) : (user.fullName || 'T&P Coordinator'),
            roleTitle: isPrimaryAdmin ? (fallback.roleTitle || user.roleTitle || 'TPO Head') : (user.roleTitle || 'SubAdmin (T&P Coordinator)'),
            employeeId: isPrimaryAdmin ? (fallback.employeeId || user.employeeId || 'RKU-TPO-101') : (user.employeeId || `RKU-TPO-${100 + user.id}`),
            department: isPrimaryAdmin ? (fallback.department || user.department || 'Training & Placement Cell') : (user.department || 'Training & Placement Cell'),
            officeLocation: isPrimaryAdmin ? (fallback.officeLocation || user.officeLocation || 'Block A, Room 104') : (user.officeLocation || 'Block A, T&P Wing'),
            mobileNumber: isPrimaryAdmin ? (fallback.mobileNumber || user.mobileNumber || '+91 98250 11001') : (user.mobileNumber || '+91 98250 11002'),
            email: isPrimaryAdmin ? (fallback.email || user.email) : user.email,
            accountRole: user.role
        };
    }

    async function handleApiRequest(url, options = {}) {
        const parsedUrl = new URL(url, window.location.origin);
        const path = parsedUrl.pathname.toLowerCase();
        const method = (options.method || 'GET').toUpperCase();

        // Small realistic delay
        await new Promise(r => setTimeout(r, 80));

        // ---- 1. AUTH ENDPOINTS ----
        if (path === '/api/auth/login' && method === 'POST') {
            const body = await readJsonBody(options);
            const email = (body.email || '').trim().toLowerCase();
            const password = body.password || '';
            const role = (body.role || '').trim();

            if (!email || !password || !role) {
                return jsonResponse({ success: false, message: 'Please fill all required fields.' }, 400);
            }

            // If a previous user was still logged in without clicking Logout, reset to fresh seed data
            if (localStorage.getItem('tp_token')) {
                window.resetDemoDb();
            }

            const db = getDb();
            const user = db.users.find(u => u.email.toLowerCase() === email && u.role === role);
            if (!user || user.password !== password) {
                return jsonResponse({ success: false, message: 'Invalid email or password.' }, 401);
            }

            if (user.role === 'Student' && !user.isApproved) {
                return jsonResponse({
                    success: false,
                    message: 'Your account is pending admin approval. Please contact the T&P Cell for more information.'
                }, 403);
            }

            if ((user.role === 'SubAdmin' || user.role === 'Admin') && !user.isApproved) {
                return jsonResponse({
                    success: false,
                    message: `Your ${user.role} access has been suspended by the Main Admin.`
                }, 403);
            }

            const student = db.students.find(s => s.userId === user.id);
            const fullName = (user.role === 'Admin' || user.role === 'SubAdmin')
                ? (user.id === 1 ? (db.adminProfile.fullName || user.fullName) : (user.fullName || 'T&P Coordinator'))
                : (student ? student.fullName : (user.fullName || 'Student'));

            return jsonResponse({
                success: true,
                token: makeDemoToken(user),
                role: user.role,
                fullName,
                email: user.email,
                isApproved: user.isApproved,
                message: 'Login successful!'
            }, 200);
        }

        if (path === '/api/auth/register' && method === 'POST') {
            const db = getDb();
            let data = {};
            if (options.body instanceof FormData) {
                options.body.forEach((value, key) => {
                    if (!(value instanceof File)) data[key] = String(value);
                });
                const consent = options.body.get('consentForm');
                const proof = options.body.get('paymentProof');
                data._hasConsent = consent instanceof File && consent.size > 0;
                data._hasProof = proof instanceof File && proof.size > 0;
            } else {
                data = await readJsonBody(options);
            }

            if (!data.enrollmentNumber || !data.fullName || !data.branch || !data.semester || !data.email || !data.password || !data.mobileNumber) {
                return jsonResponse({ success: false, message: 'Please fill all required fields.' }, 400);
            }
            if (data.password.length < 6) {
                return jsonResponse({ success: false, message: 'Password must be at least 6 characters.' }, 400);
            }
            if (data.password !== data.confirmPassword) {
                return jsonResponse({ success: false, message: 'Passwords do not match.' }, 400);
            }
            if (db.users.some(u => u.email.toLowerCase() === data.email.trim().toLowerCase())) {
                return jsonResponse({ success: false, message: 'An account with this email already exists.' }, 400);
            }
            if (db.students.some(s => s.enrollmentNumber.toLowerCase() === data.enrollmentNumber.trim().toLowerCase())) {
                return jsonResponse({ success: false, message: 'A student with this enrollment number already exists.' }, 400);
            }

            const userId = nextId(db.users);
            const studentId = nextId(db.students);
            const isPaid = Boolean(data.razorpayPaymentId);

            db.users.push({
                id: userId,
                email: data.email.trim(),
                password: data.password,
                role: 'Student',
                fullName: data.fullName.trim(),
                isApproved: false,
                createdAt: new Date().toISOString()
            });

            db.students.push({
                id: studentId,
                userId,
                enrollmentNumber: data.enrollmentNumber.trim(),
                fullName: data.fullName.trim(),
                branch: data.branch,
                semester: data.semester,
                cgpa: parseFloat(data.cgpa) || 0,
                tenthPercentage: parseFloat(data.tenthPercentage) || 0,
                twelfthPercentage: parseFloat(data.twelfthPercentage) || 0,
                email: data.email.trim(),
                personalEmail: data.personalEmail || '',
                mobileNumber: data.mobileNumber.trim(),
                parentName: data.parentName || '',
                parentEmail: data.parentEmail || '',
                parentMobile: data.parentMobile || '',
                currentAddress: data.currentAddress || '',
                permanentAddress: data.permanentAddress || '',
                city: data.city || '',
                state: data.state || '',
                pincode: data.pincode || '',
                dateOfBirth: null,
                consentFormPath: data._hasConsent ? `/demo-doc/consent/${studentId}` : null,
                paymentProofPath: data._hasProof ? `/demo-doc/payment/${studentId}` : null,
                paymentStatus: isPaid ? 'Paid' : 'Pending',
                razorpayPaymentId: data.razorpayPaymentId || null,
                paymentAmount: 9500,
                isApproved: false,
                registeredAt: new Date().toISOString()
            });

            saveDb(db);
            return jsonResponse({
                success: true,
                message: 'Registration successful! Please wait for admin approval before you can login.'
            }, 200);
        }

        if (path === '/api/auth/change-password' && method === 'POST') {
            const db = getDb();
            const user = getAuthUser(options, db);
            if (!user) return jsonResponse({ success: false, message: 'Unauthorized.' }, 401);

            const body = await readJsonBody(options);
            if (body.newPassword !== body.confirmPassword) {
                return jsonResponse({ success: false, message: 'New passwords do not match.' }, 400);
            }
            if (user.password !== body.currentPassword) {
                return jsonResponse({ success: false, message: 'Current password is incorrect.' }, 400);
            }

            user.password = body.newPassword;
            saveDb(db);
            return jsonResponse({ success: true, message: 'Password updated successfully!' }, 200);
        }

        if (path === '/api/auth/forgot-password' && method === 'POST') {
            const db = getDb();
            const body = await readJsonBody(options);
            const email = (body.email || '').trim().toLowerCase();
            if (!email || !body.newPassword) {
                return jsonResponse({ success: false, message: 'Email and new password are required.' }, 400);
            }

            const user = db.users.find(u => u.email.toLowerCase() === email);
            if (!user) {
                return jsonResponse({ success: false, message: 'No account found with this email address.' }, 404);
            }

            user.password = body.newPassword;
            saveDb(db);
            return jsonResponse({
                success: true,
                message: 'Password has been reset successfully. You can now login with your new password.'
            }, 200);
        }

        // ---- 2. PAYMENT ENDPOINT (DEMO) ----
        if (path === '/api/payment/create-order' && method === 'POST') {
            const body = await readJsonBody(options);
            return jsonResponse({
                success: true,
                orderId: `order_demo_${body.enrollmentNumber || 'RKU'}_${Date.now()}`,
                amount: 950000,
                currency: 'INR',
                keyId: 'demo_mode'
            }, 200);
        }

        // ---- 3. PUBLIC SUBMIT JD ----
        if (path === '/api/company/submit-jd' && method === 'POST') {
            const db = getDb();
            const dto = await readJsonBody(options);

            const newId = nextId(db.jobPostings);
            db.jobPostings.unshift({
                id: newId,
                companyId: newId,
                companyName: dto.companyName || 'New Recruiter',
                companyEmail: dto.email || '',
                website: dto.website || '',
                jobLocation: dto.jobLocation || 'India',
                description: dto.description || 'Submitted via Campus Placement Registration form.',
                contactName: dto.contactName || '',
                contactEmail: dto.contactEmail || '',
                contactMobile: dto.contactMobile || '',
                adminRemarks: '',
                jobPosition: dto.jobPosition || 'Software Engineer',
                annualCTC: dto.annualCtc || dto.annualCTC || 'N/A',
                internshipDuration: dto.internshipDuration || '',
                stipend: dto.stipend || '',
                bond: dto.bond || 'None',
                dateOfJoining: dto.dateOfJoining || new Date().toISOString(),
                eligibleBatches: dto.eligibleBatches || '2025, 2026',
                eligibleCourses: dto.eligibleCourses || 'B.Tech CS, B.Tech IT, MCA',
                selectionProcess: dto.selectionProcess || 'Aptitude Test + Technical Round + HR',
                campusDriveDate: dto.campusDriveDate || new Date().toISOString(),
                registrationLink: dto.registrationLink || '',
                additionalNotes: dto.additionalNotes || '',
                status: 'Pending',
                minCGPA: 6.5,
                isActive: true,
                postedAt: new Date().toISOString()
            });

            saveDb(db);
            return jsonResponse({
                success: true,
                message: 'JD submitted successfully! Our T&P team will review it shortly.'
            }, 200);
        }

        // ---- AUTHENTICATED ROUTES BELOW ----
        const db = getDb();
        const user = getAuthUser(options, db);
        if (!user) {
            return jsonResponse({ success: false, message: 'Unauthorized. Please login.' }, 401);
        }

        // ---- 4. ADMIN & SUBADMIN APIs ----
        if (path === '/api/admin/stats' && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);

            const totalStudents = db.students.length;
            const pendingApprovals = db.users.filter(u => u.role === 'Student' && !u.isApproved).length;
            const activeJobDrives = db.jobPostings.filter(j => j.status === 'Approved' && j.isActive).length;
            const totalApplications = db.applications.length;
            const shortlisted = db.applications.filter(a => a.applicationStatus === 'Shortlisted' || a.applicationStatus === 'Interview').length;
            const placed = db.applications.filter(a => ['Placed', 'Hired', 'Selected'].includes(a.applicationStatus)).length;

            return jsonResponse({
                success: true,
                data: { totalStudents, pendingApprovals, activeJobDrives, totalApplications, shortlisted, placed }
            }, 200);
        }

        if (path === '/api/admin/profile') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            if (method === 'GET') {
                return jsonResponse({ success: true, data: buildStaffProfile(user, db) }, 200);
            }
            if (method === 'PUT') {
                const body = await readJsonBody(options);
                const updated = {
                    fullName: body.fullName || user.fullName || db.adminProfile.fullName,
                    roleTitle: body.roleTitle || user.roleTitle || (user.role === 'SubAdmin' ? 'SubAdmin (T&P Coordinator)' : 'TPO Head'),
                    employeeId: body.employeeId || user.employeeId || 'RKU-TPO-101',
                    department: body.department || user.department || 'Training & Placement Cell',
                    officeLocation: body.officeLocation || user.officeLocation || 'Block A, Room 104',
                    mobileNumber: body.mobileNumber || user.mobileNumber || '+91 98250 11001',
                    email: body.email || user.email
                };
                Object.assign(user, updated);
                if (user.id === 1) {
                    Object.assign(db.adminProfile, updated);
                }
                localStorage.setItem('tp_fullName', updated.fullName);
                localStorage.setItem('tp_email', updated.email);
                saveDb(db);
                return jsonResponse({
                    success: true,
                    message: `${user.role} profile updated successfully!`,
                    data: buildStaffProfile(user, db)
                }, 200);
            }
        }

        if (path === '/api/admin/users' && method === 'GET') {
            if (!isMainAdmin(user)) {
                return jsonResponse({ success: false, message: 'Role Restriction: Only Main Admin can manage Admin and SubAdmin accounts.' }, 403);
            }
            const staff = db.users
                .filter(u => u.role === 'Admin' || u.role === 'SubAdmin')
                .map(u => ({
                    id: u.id,
                    email: u.email,
                    fullName: u.id === 1 ? (db.adminProfile.fullName || u.fullName) : u.fullName,
                    role: u.role,
                    roleTitle: u.roleTitle || (u.role === 'SubAdmin' ? 'SubAdmin (T&P Coordinator)' : 'TPO Head'),
                    department: u.department || 'Training & Placement Cell',
                    isApproved: u.isApproved,
                    isSelf: u.id === user.id,
                    createdAt: u.createdAt
                }));
            return jsonResponse({ success: true, data: staff }, 200);
        }

        if (path === '/api/admin/users' && method === 'POST') {
            if (!isMainAdmin(user)) {
                return jsonResponse({ success: false, message: 'Role Restriction: Only Main Admin can add Admin or SubAdmin accounts.' }, 403);
            }
            const body = await readJsonBody(options);
            const email = (body.email || '').trim();
            const requestedRole = body.role === 'Admin' ? 'Admin' : 'SubAdmin';
            if (!email || !body.password) {
                return jsonResponse({ success: false, message: 'Email and password are required.' }, 400);
            }
            if (body.password.length < 6) {
                return jsonResponse({ success: false, message: 'Password must be at least 6 characters.' }, 400);
            }
            if (body.password !== body.confirmPassword) {
                return jsonResponse({ success: false, message: 'Passwords do not match.' }, 400);
            }
            if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                return jsonResponse({ success: false, message: 'An account with this email already exists.' }, 400);
            }

            const newId = nextId(db.users);
            const fallbackName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const fullName = (body.fullName || '').trim() || fallbackName;
            db.users.push({
                id: newId,
                email,
                password: body.password,
                role: requestedRole,
                fullName,
                roleTitle: requestedRole === 'SubAdmin' ? 'SubAdmin (T&P Coordinator)' : 'Placement Administrator',
                employeeId: `RKU-TPO-${100 + newId}`,
                department: (body.department || '').trim() || 'Training & Placement Cell',
                officeLocation: 'Block A, T&P Wing',
                mobileNumber: `+91 98250 11${String(newId).padStart(3, '0')}`,
                isApproved: true,
                createdAt: new Date().toISOString()
            });
            saveDb(db);
            return jsonResponse({ success: true, message: `${requestedRole} access granted to ${fullName} (${email}) for this session!` }, 200);
        }

        const staffToggleMatch = path.match(/^\/api\/admin\/users\/(\d+)\/toggle-status$/);
        if (staffToggleMatch && method === 'PUT') {
            if (!isMainAdmin(user)) {
                return jsonResponse({ success: false, message: 'Role Restriction: Only Main Admin can update staff access.' }, 403);
            }
            const id = parseInt(staffToggleMatch[1], 10);
            if (id === user.id) {
                return jsonResponse({ success: false, message: 'You cannot suspend your own active session.' }, 400);
            }
            const target = db.users.find(u => u.id === id && (u.role === 'Admin' || u.role === 'SubAdmin'));
            if (!target) return jsonResponse({ success: false, message: 'Portal user not found.' }, 404);
            target.isApproved = !target.isApproved;
            saveDb(db);
            return jsonResponse({
                success: true,
                message: `${target.fullName} (${target.role}) is now ${target.isApproved ? 'Active' : 'Suspended'}.`
            }, 200);
        }

        const staffDeleteMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
        if (staffDeleteMatch && method === 'DELETE') {
            if (!isMainAdmin(user)) {
                return jsonResponse({ success: false, message: 'Role Restriction: Only Main Admin can remove staff accounts.' }, 403);
            }
            const id = parseInt(staffDeleteMatch[1], 10);
            if (id === user.id) {
                return jsonResponse({ success: false, message: 'You cannot delete your own active account.' }, 400);
            }
            const idx = db.users.findIndex(u => u.id === id && (u.role === 'Admin' || u.role === 'SubAdmin'));
            if (idx === -1) return jsonResponse({ success: false, message: 'Portal user not found.' }, 404);
            const removed = db.users.splice(idx, 1)[0];
            saveDb(db);
            return jsonResponse({ success: true, message: `${removed.fullName} (${removed.role}) removed for this session.` }, 200);
        }

        if (path === '/api/admin/students' && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const students = [...db.students].sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
            return jsonResponse({ success: true, data: students }, 200);
        }

        const studentActionMatch = path.match(/^\/api\/admin\/students\/(\d+)\/(approve|reject)$/);
        if (studentActionMatch && method === 'PUT') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const id = parseInt(studentActionMatch[1], 10);
            const action = studentActionMatch[2];
            const student = db.students.find(s => s.id === id);
            if (!student) return jsonResponse({ success: false, message: 'Student not found.' }, 404);

            const approved = action === 'approve';
            student.isApproved = approved;
            const u = db.users.find(usr => usr.id === student.userId);
            if (u) u.isApproved = approved;
            saveDb(db);

            return jsonResponse({
                success: true,
                message: approved ? `${student.fullName} has been approved successfully.` : `${student.fullName} has been rejected.`
            }, 200);
        }

        const studentDeleteMatch = path.match(/^\/api\/admin\/students\/(\d+)$/);
        if (studentDeleteMatch && method === 'DELETE') {
            if (!isMainAdmin(user)) {
                return jsonResponse({ success: false, message: 'Role Restriction: SubAdmins cannot delete student records. Only Main Admin can delete students.' }, 403);
            }
            const id = parseInt(studentDeleteMatch[1], 10);
            const idx = db.students.findIndex(s => s.id === id);
            if (idx === -1) return jsonResponse({ success: false, message: 'Student not found.' }, 404);

            const student = db.students[idx];
            const name = student.fullName;
            db.students.splice(idx, 1);
            db.users = db.users.filter(u => u.id !== student.userId);
            db.applications = db.applications.filter(a => a.studentId !== id);
            saveDb(db);

            return jsonResponse({ success: true, message: `${name} has been deleted successfully.` }, 200);
        }

        if (path === '/api/admin/placement-history' && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const history = db.jobPostings
                .filter(j => j.status === 'Approved')
                .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
                .map(j => ({
                    id: j.id,
                    companyName: j.companyName,
                    jobRole: j.jobPosition,
                    package: j.annualCTC,
                    selectedCount: db.applications.filter(a => a.jobPostingId === j.id && ['Placed', 'Hired', 'Selected'].includes(a.applicationStatus)).length,
                    campusDriveDate: j.campusDriveDate,
                    dateOfJoining: j.dateOfJoining,
                    status: j.isActive ? 'In Progress' : 'Completed'
                }));
            return jsonResponse({ success: true, data: history }, 200);
        }

        // ---- 5. COMPANY / JOB POSTINGS APIs ----
        if (path === '/api/company/job-postings' && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const postings = [...db.jobPostings].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
            return jsonResponse({ success: true, data: postings }, 200);
        }

        if (path === '/api/company/admin/schedulable-jobs' && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const jobs = db.jobPostings
                .filter(j => j.status === 'Approved' && db.applications.some(a => a.jobPostingId === j.id))
                .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
                .map(j => ({
                    id: j.id,
                    companyName: j.companyName,
                    jobRole: j.jobPosition,
                    package: j.annualCTC,
                    applicationCount: db.applications.filter(a => a.jobPostingId === j.id).length
                }));
            return jsonResponse({ success: true, data: jobs }, 200);
        }

        const jobStatusMatch = path.match(/^\/api\/company\/job-postings\/(\d+)\/status$/);
        if (jobStatusMatch && method === 'PUT') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const id = parseInt(jobStatusMatch[1], 10);
            const body = await readJsonBody(options);
            const job = db.jobPostings.find(j => j.id === id);
            if (!job) return jsonResponse({ success: false, message: 'Job posting not found.' }, 404);

            const validStatuses = ['Pending', 'Approved', 'Rejected', 'OnHold'];
            if (!validStatuses.includes(body.status)) {
                return jsonResponse({ success: false, message: 'Invalid status.' }, 400);
            }

            job.status = body.status;
            if (body.remarks) job.adminRemarks = body.remarks;
            saveDb(db);
            return jsonResponse({ success: true, message: `Job posting status updated to ${body.status}.` }, 200);
        }

        const jobDetailMatch = path.match(/^\/api\/company\/job-postings\/(\d+)$/);
        if (jobDetailMatch) {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const id = parseInt(jobDetailMatch[1], 10);
            const job = db.jobPostings.find(j => j.id === id);
            if (!job) return jsonResponse({ success: false, message: 'Job posting not found.' }, 404);

            if (method === 'GET') {
                return jsonResponse({ success: true, data: job }, 200);
            }
            if (method === 'PUT') {
                const dto = await readJsonBody(options);
                Object.assign(job, {
                    companyName: dto.companyName ?? job.companyName,
                    companyEmail: dto.email ?? job.companyEmail,
                    website: dto.website ?? job.website,
                    jobLocation: dto.jobLocation ?? job.jobLocation,
                    description: dto.description ?? job.description,
                    contactName: dto.contactName ?? job.contactName,
                    contactEmail: dto.contactEmail ?? job.contactEmail,
                    contactMobile: dto.contactMobile ?? job.contactMobile,
                    jobPosition: dto.jobPosition ?? job.jobPosition,
                    annualCTC: dto.annualCTC ?? job.annualCTC,
                    internshipDuration: dto.internshipDuration ?? job.internshipDuration,
                    stipend: dto.stipend ?? job.stipend,
                    bond: dto.bond ?? job.bond,
                    dateOfJoining: dto.dateOfJoining ?? job.dateOfJoining,
                    eligibleBatches: dto.eligibleBatches ?? job.eligibleBatches,
                    eligibleCourses: dto.eligibleCourses ?? job.eligibleCourses,
                    selectionProcess: dto.selectionProcess ?? job.selectionProcess,
                    campusDriveDate: dto.campusDriveDate ?? job.campusDriveDate,
                    registrationLink: dto.registrationLink ?? job.registrationLink,
                    additionalNotes: dto.additionalNotes ?? job.additionalNotes
                });
                saveDb(db);
                return jsonResponse({ success: true, message: 'Job posting updated successfully.' }, 200);
            }
            if (method === 'DELETE') {
                if (!isMainAdmin(user)) {
                    return jsonResponse({ success: false, message: 'Role Restriction: SubAdmins cannot delete company job postings. Only Main Admin can delete records.' }, 403);
                }
                db.jobPostings = db.jobPostings.filter(j => j.id !== id);
                db.applications = db.applications.filter(a => a.jobPostingId !== id);
                db.interviewSchedules = db.interviewSchedules.filter(s => s.jobPostingId !== id);
                saveDb(db);
                return jsonResponse({ success: true, message: 'Job posting deleted successfully.' }, 200);
            }
        }

        if (path === '/api/company/approved-jobs' && method === 'GET') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const jobs = db.jobPostings
                .filter(j => j.status === 'Approved' && j.isActive)
                .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
            return jsonResponse({ success: true, data: jobs }, 200);
        }

        const approvedJobMatch = path.match(/^\/api\/company\/approved-jobs\/(\d+)$/);
        if (approvedJobMatch && method === 'GET') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const id = parseInt(approvedJobMatch[1], 10);
            const job = db.jobPostings.find(j => j.id === id && j.status === 'Approved' && j.isActive);
            if (!job) return jsonResponse({ success: false, message: 'Job not found.' }, 404);
            return jsonResponse({ success: true, data: job }, 200);
        }

        // ---- 6. APPLICATIONS APIs ----
        const applyMatch = path.match(/^\/api\/applications\/apply(?:\/(\d+))?$/);
        if (applyMatch && method === 'POST') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const student = db.students.find(s => s.userId === user.id);
            if (!student) return jsonResponse({ success: false, message: 'Student profile not found.' }, 400);

            const body = await readJsonBody(options);
            const jobId = applyMatch[1] ? parseInt(applyMatch[1], 10) : parseInt(body.jobPostingId, 10);

            const alreadySelected = db.applications.some(a => a.studentId === student.id && a.applicationStatus === 'Selected');
            if (alreadySelected) {
                return jsonResponse({ success: false, message: 'You have already been selected for a job and cannot apply for more.' }, 400);
            }

            const job = db.jobPostings.find(j => j.id === jobId && j.status === 'Approved' && j.isActive);
            if (!job) {
                return jsonResponse({ success: false, message: 'Job not found or not available for application.' }, 404);
            }

            if (db.applications.some(a => a.studentId === student.id && a.jobPostingId === jobId)) {
                return jsonResponse({ success: false, message: 'You have already applied for this job.' }, 400);
            }

            db.applications.push({
                id: nextId(db.applications),
                studentId: student.id,
                jobPostingId: jobId,
                applicationStatus: 'Applied',
                appliedAt: new Date().toISOString()
            });
            saveDb(db);
            return jsonResponse({ success: true, message: 'Application submitted successfully!' }, 200);
        }

        if (path === '/api/applications/my-applications' && method === 'GET') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const student = db.students.find(s => s.userId === user.id);
            if (!student) return jsonResponse({ success: false, message: 'Student profile not found.' }, 400);

            const apps = db.applications
                .filter(a => a.studentId === student.id)
                .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
                .map(a => {
                    const job = db.jobPostings.find(j => j.id === a.jobPostingId) || {};
                    return {
                        id: a.id,
                        jobPostingId: a.jobPostingId,
                        companyName: job.companyName || 'Company',
                        jobRole: job.jobPosition || 'Role',
                        package: job.annualCTC || 'N/A',
                        applicationStatus: a.applicationStatus,
                        appliedAt: a.appliedAt
                    };
                });
            return jsonResponse({ success: true, data: apps }, 200);
        }

        const checkAppMatch = path.match(/^\/api\/applications\/check\/(\d+)$/);
        if (checkAppMatch && method === 'GET') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const student = db.students.find(s => s.userId === user.id);
            const jobId = parseInt(checkAppMatch[1], 10);
            const hasApplied = student ? db.applications.some(a => a.studentId === student.id && a.jobPostingId === jobId) : false;
            return jsonResponse({ success: true, hasApplied }, 200);
        }

        if (path === '/api/applications/stats' && method === 'GET') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const student = db.students.find(s => s.userId === user.id);
            if (!student) return jsonResponse({ success: false, message: 'Student profile not found.' }, 400);

            const myApps = db.applications.filter(a => a.studentId === student.id);
            const totalApplications = myApps.length;
            const shortlisting = myApps.filter(a => a.applicationStatus === 'Shortlisted' || a.applicationStatus === 'Interview').length;
            const selections = myApps.filter(a => ['Placed', 'Hired', 'Selected'].includes(a.applicationStatus)).length;

            const nonRejected = myApps.filter(a => a.applicationStatus !== 'Rejected');
            const upcomingInterviews = db.interviewSchedules.filter(s => {
                if (s.status !== 'Pending') return false;
                const app = nonRejected.find(a => a.jobPostingId === s.jobPostingId);
                if (!app) return false;
                if (s.roundNumber === 1) return true;
                return app.applicationStatus === 'Shortlisted' || app.applicationStatus === 'Selected';
            }).length;

            return jsonResponse({
                success: true,
                data: { totalApplications, shortlisting, selections, upcomingInterviews }
            }, 200);
        }

        if (path === '/api/applications/admin/applied-companies' && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const companies = db.jobPostings
                .filter(j => j.status === 'Approved' && db.applications.some(a => a.jobPostingId === j.id))
                .map(j => ({
                    jobPostingId: j.id,
                    companyName: j.companyName,
                    companyId: j.companyId,
                    jobRole: j.jobPosition,
                    applicationCount: db.applications.filter(a => a.jobPostingId === j.id).length
                }));
            return jsonResponse({ success: true, data: companies }, 200);
        }

        const jobStudentsMatch = path.match(/^\/api\/applications\/admin\/job\/(\d+)\/students$/);
        if (jobStudentsMatch && method === 'GET') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const jobId = parseInt(jobStudentsMatch[1], 10);
            const students = db.applications
                .filter(a => a.jobPostingId === jobId)
                .map(a => {
                    const s = db.students.find(st => st.id === a.studentId);
                    if (!s) return null;
                    return {
                        applicationId: a.id,
                        studentId: a.studentId,
                        studentName: s.fullName,
                        enrollmentNumber: s.enrollmentNumber,
                        branch: s.branch,
                        semester: s.semester,
                        cgpa: s.cgpa,
                        applicationStatus: a.applicationStatus,
                        appliedAt: a.appliedAt
                    };
                })
                .filter(Boolean);
            return jsonResponse({ success: true, data: students }, 200);
        }

        const appStatusMatch = path.match(/^\/api\/applications\/admin\/(\d+)\/status$/);
        if (appStatusMatch && method === 'PUT') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const appId = parseInt(appStatusMatch[1], 10);
            const body = await readJsonBody(options);
            const app = db.applications.find(a => a.id === appId);
            if (!app) return jsonResponse({ success: false, message: 'Application not found.' }, 404);

            const validStatuses = ['Applied', 'Shortlisted', 'Selected', 'Rejected'];
            if (!validStatuses.includes(body.status)) {
                return jsonResponse({ success: false, message: 'Invalid status.' }, 400);
            }
            app.applicationStatus = body.status;
            saveDb(db);
            return jsonResponse({ success: true, message: 'Application status updated successfully.' }, 200);
        }

        // ---- 7. INTERVIEW SCHEDULES APIs ----
        if (path === '/api/admin/interview-schedules') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);

            if (method === 'GET') {
                const schedules = [...db.interviewSchedules]
                    .sort((a, b) => (a.jobPostingId - b.jobPostingId) || (a.roundNumber - b.roundNumber))
                    .map(s => {
                        const job = db.jobPostings.find(j => j.id === s.jobPostingId) || {};
                        return {
                            id: s.id,
                            jobPostingId: s.jobPostingId,
                            companyName: job.companyName || 'Company',
                            jobRole: job.jobPosition || 'Role',
                            annualCTC: job.annualCTC || 'N/A',
                            roundNumber: s.roundNumber,
                            roundName: s.roundName,
                            interviewDate: s.interviewDate,
                            interviewType: s.interviewType,
                            locationOrLink: s.locationOrLink,
                            waitingArea: s.waitingArea,
                            instructions: s.instructions,
                            status: s.status
                        };
                    });
                return jsonResponse({ success: true, data: schedules }, 200);
            }

            if (method === 'POST') {
                const dtos = await readJsonBody(options);
                if (!Array.isArray(dtos) || dtos.length === 0) {
                    return jsonResponse({ success: false, message: 'No schedules provided.' }, 400);
                }
                const jobPostingId = dtos[0].jobPostingId;
                db.interviewSchedules = db.interviewSchedules.filter(s => s.jobPostingId !== jobPostingId);

                let nid = nextId(db.interviewSchedules);
                dtos.forEach(dto => {
                    db.interviewSchedules.push({
                        id: nid++,
                        jobPostingId: dto.jobPostingId,
                        roundNumber: dto.roundNumber,
                        roundName: dto.roundName,
                        interviewDate: dto.interviewDate,
                        interviewType: dto.interviewType || 'Offline',
                        locationOrLink: dto.locationOrLink || '',
                        waitingArea: dto.waitingArea || '',
                        instructions: dto.instructions || '',
                        status: dto.status || 'Pending'
                    });
                });
                saveDb(db);
                return jsonResponse({ success: true, message: 'Interview schedules saved successfully.' }, 200);
            }
        }

        const scheduleStatusMatch = path.match(/^\/api\/admin\/interview-schedules\/(\d+)\/status$/);
        if (scheduleStatusMatch && method === 'PUT') {
            if (!isAdminOrSubAdmin(user)) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const id = parseInt(scheduleStatusMatch[1], 10);
            const body = await readJsonBody(options);
            const sched = db.interviewSchedules.find(s => s.id === id);
            if (!sched) return jsonResponse({ success: false, message: 'Schedule not found.' }, 404);
            sched.status = body.status;
            saveDb(db);
            return jsonResponse({ success: true, message: 'Status updated successfully.' }, 200);
        }

        if (path === '/api/student/interview-schedules' && method === 'GET') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const student = db.students.find(s => s.userId === user.id);
            if (!student) return jsonResponse({ success: false, message: 'Student profile not found.' }, 401);

            const nonRejectedApps = db.applications.filter(a => a.studentId === student.id && a.applicationStatus !== 'Rejected');
            const appliedJobIds = nonRejectedApps.map(a => a.jobPostingId);

            const eligible = db.interviewSchedules
                .filter(s => appliedJobIds.includes(s.jobPostingId))
                .filter(s => {
                    const app = nonRejectedApps.find(a => a.jobPostingId === s.jobPostingId);
                    if (!app) return false;
                    if (s.roundNumber === 1) return true;
                    return app.applicationStatus === 'Shortlisted' || app.applicationStatus === 'Selected';
                })
                .sort((a, b) => (a.jobPostingId - b.jobPostingId) || (a.roundNumber - b.roundNumber))
                .map(s => {
                    const job = db.jobPostings.find(j => j.id === s.jobPostingId) || {};
                    return {
                        id: s.id,
                        companyName: job.companyName || 'Company',
                        jobRole: job.jobPosition || 'Role',
                        annualCTC: job.annualCTC || 'N/A',
                        roundNumber: s.roundNumber,
                        roundName: s.roundName,
                        interviewDate: s.interviewDate,
                        interviewType: s.interviewType,
                        locationOrLink: s.locationOrLink,
                        waitingArea: s.waitingArea,
                        instructions: s.instructions,
                        status: s.status
                    };
                });
            return jsonResponse({ success: true, data: eligible }, 200);
        }

        // ---- 8. STUDENT PROFILE APIs ----
        if (path === '/api/student/profile') {
            if (user.role !== 'Student') return jsonResponse({ success: false, message: 'Forbidden' }, 403);
            const student = db.students.find(s => s.userId === user.id);
            if (!student) return jsonResponse({ success: false, message: 'Student profile not found.' }, 404);

            if (method === 'GET') {
                const recentApplications = db.applications
                    .filter(a => a.studentId === student.id)
                    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
                    .slice(0, 3)
                    .map(a => {
                        const job = db.jobPostings.find(j => j.id === a.jobPostingId) || {};
                        return {
                            jobPosition: job.jobPosition || 'Role',
                            companyName: job.companyName || 'Company',
                            status: a.applicationStatus,
                            appliedAt: a.appliedAt,
                            jobType: 'Full-time'
                        };
                    });

                const regYear = new Date(student.registeredAt).getFullYear();
                return jsonResponse({
                    success: true,
                    data: {
                        fullName: student.fullName,
                        enrollmentNumber: student.enrollmentNumber,
                        branch: student.branch,
                        semester: student.semester,
                        mobileNumber: student.mobileNumber,
                        email: student.email,
                        personalEmail: student.personalEmail,
                        parentName: student.parentName,
                        parentMobile: student.parentMobile,
                        cgpa: student.cgpa,
                        dateOfBirth: student.dateOfBirth,
                        academicYear: `${regYear}-${regYear + 1}`,
                        recentApplications
                    }
                }, 200);
            }

            if (method === 'PUT') {
                const dto = await readJsonBody(options);
                student.fullName = dto.fullName ?? student.fullName;
                student.mobileNumber = dto.mobileNumber ?? student.mobileNumber;
                student.parentName = dto.parentName ?? student.parentName;
                student.parentMobile = dto.parentMobile ?? student.parentMobile;
                student.personalEmail = dto.personalEmail ?? student.personalEmail;
                student.semester = dto.semester ?? student.semester;
                student.dateOfBirth = dto.dateOfBirth ?? student.dateOfBirth;
                user.fullName = student.fullName;
                localStorage.setItem('tp_fullName', student.fullName);
                saveDb(db);
                return jsonResponse({ success: true, message: 'Profile updated successfully.' }, 200);
            }
        }

        return jsonResponse({ success: false, message: `Endpoint not found: ${path}` }, 404);
    }

    // Intercept window.fetch for /api/* calls
    window.fetch = function (input, options) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (url && (url.startsWith('/api/') || url.includes('/api/'))) {
            return handleApiRequest(url, options);
        }
        return nativeFetch(input, options);
    };

    // Mock Razorpay Checkout for Demo Registration
    window.Razorpay = function (options) {
        return {
            on: function () {},
            open: function () {
                const existing = document.getElementById('demoRazorpayModal');
                if (existing) existing.remove();

                const modal = document.createElement('div');
                modal.id = 'demoRazorpayModal';
                modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
                        <div class="bg-[#e7000b] text-white p-5 flex justify-between items-center">
                            <div>
                                <p class="text-xs uppercase font-bold tracking-wider opacity-90 m-0">Razorpay Demo Checkout</p>
                                <h3 class="text-lg font-bold m-0 mt-0.5">${options.name || 'RK University'}</h3>
                            </div>
                            <span class="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">₹${((options.amount || 950000) / 100).toLocaleString('en-IN')}</span>
                        </div>
                        <div class="p-6 space-y-4">
                            <p class="text-sm text-gray-600 m-0">${options.description || 'Training & Placement Registration Fee'}</p>
                            <div class="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 space-y-1 border">
                                <div><strong>Student:</strong> ${(options.prefill && options.prefill.name) || 'Demo Student'}</div>
                                <div><strong>Email:</strong> ${(options.prefill && options.prefill.email) || ''}</div>
                                <div><strong>Order ID:</strong> <span class="font-mono">${options.order_id || 'order_demo'}</span></div>
                            </div>
                            <p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 m-0">
                                <i class="fas fa-info-circle mr-1"></i> Demo Payment Mode: No real money is charged.
                            </p>
                            <div class="flex gap-3 pt-2">
                                <button type="button" id="demoRzpCancel" class="flex-1 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold cursor-pointer">Cancel</button>
                                <button type="button" id="demoRzpPay" class="flex-1 py-2.5 rounded-lg border-none bg-green-600 hover:bg-green-700 text-white font-bold cursor-pointer">Simulate Payment ✓</button>
                            </div>
                        </div>
                    </div>`;
                document.body.appendChild(modal);

                document.getElementById('demoRzpCancel').onclick = function () {
                    modal.remove();
                    if (options.modal && typeof options.modal.ondismiss === 'function') {
                        options.modal.ondismiss();
                    }
                };
                document.getElementById('demoRzpPay').onclick = function () {
                    modal.remove();
                    if (typeof options.handler === 'function') {
                        options.handler({
                            razorpay_order_id: options.order_id || ('order_demo_' + Date.now()),
                            razorpay_payment_id: 'pay_demo_IN_' + Math.floor(100000 + Math.random() * 900000),
                            razorpay_signature: 'sig_demo_verified'
                        });
                    }
                };
            }
        };
    };

    // Intercept clicks on student document links (/api/admin/students/{id}/document/{type})
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a[href*="/api/admin/students/"][href*="/document/"]');
        if (!link) return;
        e.preventDefault();

        const match = link.getAttribute('href').match(/\/api\/admin\/students\/(\d+)\/document\/(\w+)/i);
        if (!match) return;
        const studentId = parseInt(match[1], 10);
        const docType = match[2].toLowerCase();
        const db = getDb();
        const student = db.students.find(s => s.id === studentId);
        if (!student) return;

        const existing = document.getElementById('demoDocModal');
        if (existing) existing.remove();

        const isConsent = docType === 'consent';
        const modal = document.createElement('div');
        modal.id = 'demoDocModal';
        modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
                <div class="bg-[#d8cfc3] px-6 py-4 flex justify-between items-center border-b">
                    <div class="flex items-center gap-2">
                        <i class="fas ${isConsent ? 'fa-file-pdf text-red-600' : 'fa-receipt text-blue-600'} text-lg"></i>
                        <h3 class="font-bold text-gray-900 text-base m-0">${isConsent ? 'Student Consent Form (Sample Seed Document)' : 'T&P Fee Payment Receipt (Sample)'}</h3>
                    </div>
                    <button type="button" onclick="document.getElementById('demoDocModal').remove()" class="text-gray-600 hover:text-gray-900 bg-transparent border-none text-lg cursor-pointer">&times;</button>
                </div>
                <div class="p-6 space-y-4 text-sm text-gray-700">
                    <div class="border rounded-xl p-5 bg-gray-50 space-y-2">
                        <p class="font-bold text-center text-gray-900 uppercase tracking-wide m-0 mb-3">RK University – Training &amp; Placement Cell</p>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div><strong>Student Name:</strong> ${student.fullName}</div>
                            <div><strong>Enrollment No:</strong> ${student.enrollmentNumber}</div>
                            <div><strong>Branch:</strong> ${student.branch}</div>
                            <div><strong>Semester:</strong> ${student.semester}</div>
                            <div><strong>City / State:</strong> ${student.city || 'Rajkot'}, ${student.state || 'Gujarat'}</div>
                            <div><strong>Status:</strong> ${isConsent ? 'Signed & Submitted' : student.paymentStatus}</div>
                        </div>
                        <hr class="my-3 border-gray-300" />
                        ${isConsent
                            ? `<p class="text-xs leading-relaxed text-gray-600 m-0">I, <strong>${student.fullName}</strong> (${student.enrollmentNumber}), confirm my consent to participate in the RK University Campus Placement Drives 2026 and abide by the T&amp;P Cell placement guidelines.</p>`
                            : `<p class="text-xs leading-relaxed text-gray-600 m-0"><strong>Transaction ID:</strong> ${student.razorpayPaymentId || 'DEMO-TXN-IN-2026'}<br/><strong>Amount Paid:</strong> ₹${(student.paymentAmount || 9500).toLocaleString('en-IN')} INR<br/><strong>Mode:</strong> Razorpay Online (Demo Seed Record)</p>`
                        }
                    </div>
                    <div class="flex justify-end">
                        <button type="button" onclick="document.getElementById('demoDocModal').remove()" class="px-5 py-2 bg-[#e7000b] text-white rounded-lg font-bold text-xs uppercase border-none cursor-pointer">Close Preview</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    });

    // Helper for 1-click Demo Login on Login page
    window.demoQuickLogin = function (role, email, password) {
        const roleEl = document.getElementById('loginRole');
        const emailEl = document.getElementById('loginEmail');
        const pwdEl = document.getElementById('loginPassword');
        if (roleEl) roleEl.value = role;
        if (emailEl) emailEl.value = email;
        if (pwdEl) pwdEl.value = password;
        if (typeof handleLogin === 'function') {
            handleLogin();
        }
    };

    // Subtle Demo Mode pill on authenticated pages
    document.addEventListener('DOMContentLoaded', function () {
        if (!localStorage.getItem('tp_token')) return;
        const p = window.location.pathname.toLowerCase();
        if (p.includes('login') || p === '/' || p === '/home' || p === '/home/index') return;

        const role = localStorage.getItem('tp_role') || 'Demo';
        const badge = document.createElement('div');
        badge.className = 'fixed bottom-2 right-2 sm:bottom-3 sm:right-3 z-40 bg-gray-800/90 text-white text-[10px] sm:text-[11px] font-medium px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-md flex items-center gap-1.5 sm:gap-2 pointer-events-none select-none max-w-[calc(100vw-1rem)] truncate';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span><span class="truncate">Demo Mode (${role}) • Indian Seed Data • Resets on Logout</span>`;
        document.body.appendChild(badge);
    });
})();
