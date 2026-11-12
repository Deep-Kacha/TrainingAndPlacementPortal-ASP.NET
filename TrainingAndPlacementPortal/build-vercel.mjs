import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const appDir = path.join(rootDir, 'TrainingAndPlacementPortal');
const viewsDir = path.join(appDir, 'Views');
const wwwrootDir = path.join(appDir, 'wwwroot');
const outDir = path.join(rootDir, 'vercel-public');
const srcDir = path.join(rootDir, 'vercel-src');

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    ensureDir(dir);
}

function readView(relPath) {
    return fs.readFileSync(path.join(viewsDir, relPath), 'utf8').replace(/\uFEFF/g, '');
}

function extractTitle(content) {
    const m = content.match(/ViewData\["Title"\]\s*=\s*"([^"]+)"/);
    return m ? m[1] : 'TP Portal';
}

function stripRazorHeader(content) {
    return content.replace(/@\{\s*[\s\S]*?\}\s*/m, '');
}

function extractScriptsSection(content) {
    // Match @section Scripts { ... } handling balanced braces
    const marker = '@section Scripts';
    const idx = content.indexOf(marker);
    if (idx === -1) return { html: content, scripts: '' };

    const braceStart = content.indexOf('{', idx);
    if (braceStart === -1) return { html: content, scripts: '' };

    let depth = 0;
    let endIdx = -1;
    for (let i = braceStart; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
            depth--;
            if (depth === 0) {
                endIdx = i;
                break;
            }
        }
    }

    if (endIdx === -1) return { html: content, scripts: '' };

    const scripts = content.slice(braceStart + 1, endIdx).trim();
    const html = (content.slice(0, idx) + content.slice(endIdx + 1)).trim();
    return { html, scripts };
}

function cleanPaths(html) {
    return html
        .replace(/~\/images\//g, '/images/')
        .replace(/~\/css\//g, '/css/')
        .replace(/~\/js\//g, '/js/')
        .replace(/\s+asp-append-version="true"/g, '');
}

function sanitizePersonalInfo(html) {
    // Replace any personal/test strings with Indian seed data for production demo
    return html
        .replace(/Admin Profile Edit Test/g, 'Admin Profile')
        .replace(/Dr\. Vishal Doshi/g, 'Dr. Rajesh Kulkarni')
        .replace(/Vishal Doshi/g, 'Dr. Rajesh Kulkarni')
        .replace(/Mr\. Osho Shah/g, 'Prof. Anjali Mehta')
        .replace(/vishal\.doshi@rku\.ac\.in/g, 'admin@rku.ac.in')
        .replace(/\+91 98765 43210/g, '+91 98250 11001')
        .replace(/\+91 87654 32109/g, '+91 98250 11002')
        .replace(/26FGHP579/g, 'RKU-TPO-101')
        .replace(/Training & Placement Shell/g, 'Training & Placement Cell')
        .replace(/Office No \.27/g, 'Block A, Room 104')
        .replace(/>VD</g, '>RK<')
        .replace(/e\.g\. Shweta Jethwa/g, 'e.g. Siddharth Rao')
        .replace(/e\.g\. Multiicon/g, 'e.g. Tata Consultancy Services')
        .replace(/e\.g\. info@multiicon\.in/g, 'e.g. campus@tcs-demo.in')
        .replace(/e\.g\. https:\/\/multiicon\.in/g, 'e.g. https://www.tcs.com')
        .replace(/e\.g\. hr@multiicon\.in/g, 'e.g. hr@tcs-demo.in')
        .replace(/e\.g\. Rajkot \/ Remote/g, 'e.g. Ahmedabad / Pune')
        .replace(/e\.g\. PHP Developer/g, 'e.g. Software Engineer')
        .replace(/e\.g\. ₹3\.6 LPA/g, 'e.g. ₹7.0 LPA')
        .replace(/e\.g\. 9876543210/g, 'e.g. 9825011223');
}

function makeResponsiveHeader(html) {
    return html
        .replace(
            '<button class="md:hidden text-2xl" onclick="toggleMobileMenu()">☰</button>',
            '<button type="button" aria-label="Toggle Menu" class="md:hidden text-2xl p-2 bg-transparent border-none cursor-pointer text-gray-800" onclick="toggleMobileMenu()">☰</button>'
        )
        .replace(
            '<img src="/images/logo.png" alt="RK University" class="h-14" />',
            '<img src="/images/logo.png" alt="RK University" class="h-10 sm:h-14" />'
        );
}

function makeResponsiveFooter(html) {
    return html
        .replace(
            '<div class="max-w-7xl mx-auto px-8 py-10 grid md:grid-cols-4 gap-8">',
            '<div class="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">'
        )
        .replace(
            '<div class="border-t border-gray-400 text-sm py-4 px-8 flex justify-between">',
            '<div class="border-t border-gray-400 text-sm py-4 px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">'
        );
}

function renderSidebar(partialPath) {
    let raw = readView(partialPath);
    // Remove Razor @{ ... } block and @GetActiveClass("...") calls; site.js applies active state cleanly
    raw = raw.replace(/@\{[\s\S]*?\}/g, '');
    raw = raw.replace(/@GetActiveClass\("[^"]*"\)/g, '');
    return cleanPaths(raw)
        .replace(
            '<button class="text-2xl md:hidden" onclick="toggleSidebar()">',
            '<button type="button" aria-label="Toggle Sidebar" class="text-2xl md:hidden p-2 bg-transparent border-none cursor-pointer text-gray-800 rounded-md hover:bg-black/5" onclick="toggleSidebar()">'
        )
        .trim();
}

function renderHomeIndex() {
    let raw = readView('Home/Index.cshtml');
    raw = stripRazorHeader(raw);
    raw = raw.replace(/@await Html\.PartialAsync\("_Header"\)/g, makeResponsiveHeader(cleanPaths(readView('Shared/_Header.cshtml'))));
    raw = raw.replace(/@await Html\.PartialAsync\("_Footer"\)/g, makeResponsiveFooter(cleanPaths(readView('Shared/_Footer.cshtml'))));

    const imgs = ['gateway.jpg', 'multiicon.jpg', 'qtonz.png', 'rkit.jpg', 'infinity.jpg', 'tcs.jpg', 'rtcamp.png'];
    const doubled = [...imgs, ...imgs];
    const marqueeHtml = doubled.map(img => `
        <div class="bg-[#d8d1c7] flex items-center justify-center rounded-lg shadow-md px-8 sm:px-16 md:px-[6.25rem] py-12 sm:py-16 md:py-20 min-w-[150px] sm:min-w-[200px] h-[88px] sm:h-[100px]">
            <img src="/images/${img}" alt="company" class="max-h-16 sm:max-h-[7.5rem] object-contain" />
        </div>`).join('');

    raw = raw.replace(/@foreach \(var img in new\[\] \{[\s\S]*?\}\)\s*\{[\s\S]*?\}/m, marqueeHtml);

    raw = cleanPaths(raw)
        .replace(
            'class="relative max-w-7xl px-8 lg:px-16 py-[11.25rem]"',
            'class="relative max-w-7xl px-5 sm:px-8 lg:px-16 py-20 sm:py-28 md:py-36 lg:py-[11.25rem]"'
        )
        .replace(
            'class="text-4xl md:text-5xl font-bold text-gray-900 leading-tight"',
            'class="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight"'
        )
        .replace(
            '<section id="placements" class="py-20 bg-gray-100">',
            '<section id="placements" class="py-12 md:py-20 px-4 sm:px-6 bg-gray-100">'
        )
        .replace(
            '<div class="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">',
            '<div class="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8">'
        )
        .replace(
            '<div class="mt-12 bg-gradient-to-r from-red-800 to-red-600 rounded-xl shadow-lg p-10 text-white">',
            '<div class="mt-10 md:mt-12 bg-gradient-to-r from-red-800 to-red-600 rounded-xl shadow-lg p-6 sm:p-8 md:p-10 text-white">'
        )
        .replace(
            '<div class="grid md:grid-cols-4 gap-8 text-center">',
            '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">'
        )
        .replace(
            '<div class="flex animate-scroll gap-20 w-max px-20">',
            '<div class="flex animate-scroll gap-6 sm:gap-12 md:gap-20 w-max px-4 sm:px-10 md:px-20">'
        )
        .replace(
            '<section id="about" class="bg-gray-100 py-24 px-6">',
            '<section id="about" class="bg-gray-100 py-14 md:py-24 px-4 sm:px-6">'
        )
        .replace(
            '<div class="grid md:grid-cols-2 gap-16 items-center">',
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">'
        )
        .replace(
            'class="w-full h-[320px] object-cover rounded-xl shadow-lg"',
            'class="w-full h-56 sm:h-72 md:h-[320px] object-cover rounded-xl shadow-lg"'
        );

    return raw;
}

function renderAdminDashboard() {
    let raw = readView('Admin/Dashboard.cshtml');
    raw = stripRazorHeader(raw);
    const { html, scripts } = extractScriptsSection(raw);

    const actions = [
        { Title: 'Companies', Desc: 'Explore Company details and JD', Btn: 'View Companies →', Href: '/AdminCompanyManagement', Icon: 'fa-briefcase', Color: 'text-orange-500' },
        { Title: 'Students', Desc: 'Explore Student Details', Btn: 'View Student Details →', Href: '/AdminStudentsManagement', Icon: 'fa-search', Color: 'text-cyan-500' },
        { Title: 'Interview Schedule', Desc: 'Manage Interviews', Btn: 'View Schedules →', Href: '/AdminInterviewSchedule', Icon: 'fa-file-alt', Color: 'text-blue-600' },
        { Title: 'History', Desc: 'Explore Placement History', Btn: 'View Placement History →', Href: '/AdminPlacementHistory', Icon: 'fa-clock', Color: 'text-red-500' },
        { Title: 'Profile', Desc: 'Update your information', Btn: 'Edit Profile →', Href: '/AdminProfile', Icon: 'fa-users', Color: 'text-purple-500' }
    ];

    const cardsHtml = actions.map(a => `
            <div class="bg-[#d1c2b5] p-8 rounded-xl shadow text-center border border-[#c4b5a6] transition-transform hover:scale-[1.02]">
                <div class="flex justify-center mb-4 text-3xl">
                    <i class="fas ${a.Icon} ${a.Color}"></i>
                </div>
                <h3 class="text-lg font-bold mb-1 m-0">${a.Title}</h3>
                <p class="text-gray-700 text-sm m-0">${a.Desc}</p>
                <a href="${a.Href}" class="mt-4 font-bold ${a.Color} inline-block cursor-pointer border-none bg-transparent no-underline uppercase tracking-tight text-xs">
                    ${a.Btn}
                </a>
            </div>`).join('');

    const cleanHtml = html.replace(/@\{[\s\S]*?@foreach \(var a in actions\)\s*\{[\s\S]*?\}/m, cardsHtml);
    return { html: cleanPaths(cleanHtml), scripts };
}

function renderStudentDashboard() {
    let raw = readView('Student/Dashboard.cshtml');
    raw = stripRazorHeader(raw);
    const { html, scripts } = extractScriptsSection(raw);

    const actions = [
        { Title: 'Browse Jobs', Desc: 'Explore available opportunities', Link: 'View Jobs', Href: '/StudJobs', Icon: '🔍', Color: 'bg-[#dbeafe] text-blue-600' },
        { Title: 'My Applied', Desc: 'Track application status', Link: 'View Applied', Href: '/StudApplications', Icon: '📋', Color: 'bg-[#fefce8] text-yellow-600' },
        { Title: 'Profile', Desc: 'Update your information', Link: 'Edit Profile', Href: '/StudProfile', Icon: '👤', Color: 'bg-[#f3e8ff] text-purple-600' },
        { Title: 'Interviews', Desc: 'Manage interview schedule', Link: 'View Schedule', Href: '/StudInterviewSchedule', Icon: '🗓️', Color: 'bg-[#fef2f2] text-red-600' }
    ];

    const cardsHtml = actions.map(action => `
                <a href="${action.Href}" class="bg-[#ece6da] border border-[#e0dacd] p-6 rounded-2xl shadow-sm transition-all hover:shadow-md hover:scale-[1.02] flex flex-col items-center text-center no-underline text-inherit group">
                    <div class="w-16 h-16 ${action.Color} rounded-2xl flex items-center justify-center mb-4 text-3xl shadow-sm group-hover:scale-110 transition-transform">${action.Icon}</div>
                    <h3 class="text-lg font-bold my-2 text-gray-900">${action.Title}</h3>
                    <p class="text-gray-600 text-xs font-semibold mb-5 leading-snug w-full">${action.Desc}</p>
                    <span class="text-[#e7000b] font-bold text-xs uppercase tracking-wider mt-auto group-hover:underline">${action.Link} ➔</span>
                </a>`).join('');

    const cleanHtml = html.replace(/@foreach \(var action in new\[\] \{[\s\S]*?\}\)\s*\{[\s\S]*?\}/m, cardsHtml);
    return { html: cleanPaths(cleanHtml), scripts };
}

function renderAdminJdDetail() {
    let raw = readView('Admin/JdDetail.cshtml');
    raw = stripRazorHeader(raw);
    const { html, scripts } = extractScriptsSection(raw);

    const batches = ['2025', '2024', '2023']
        .map(b => `<label class="flex items-center gap-2"><input type="checkbox" value="${b}" disabled class="jd-editable batch-cb" /> ${b}</label>`)
        .join('\n                        ');
    const courses = ['B.Tech CS', 'B.Tech IT', 'Mechanical', 'Civil', 'Electrical', 'BCA', 'MCA', 'MBA']
        .map(c => `<label class="flex items-center gap-2"><input type="checkbox" value="${c}" disabled class="jd-editable course-cb" /> ${c}</label>`)
        .join('\n                            ');

    let cleanHtml = html
        .replace(/@foreach \(var b in new\[\] \{[^\}]+\}\) \{[^\}]+\}/, batches)
        .replace(/@foreach \(var c in new\[\] \{[^\}]+\}\) \{[\s\S]*?\}/, courses);

    return { html: sanitizePersonalInfo(cleanPaths(cleanHtml)), scripts };
}

function enhanceLoginHtml(html, scripts) {
    const withSubAdminOption = html.replace(
        '<option value="Admin">Admin</option>',
        '<option value="Admin">Admin</option>\n                    <option value="SubAdmin">SubAdmin</option>'
    );

    const demoBox = `
            <!-- Demo Login Credentials & Quick Access -->
            <div class="mt-6 pt-5 border-t border-gray-400/50">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-gray-800"><i class="fas fa-key text-red-600 mr-1.5"></i>Demo Access (Seed Data)</span>
                    <span class="text-[10px] font-semibold bg-white/80 text-gray-700 px-2 py-0.5 rounded-full">Resets on Logout</span>
                </div>
                <div class="space-y-2 text-xs">
                    <div class="bg-white/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-gray-300">
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900">Admin (TPO Head)</div>
                            <div class="text-gray-600 font-mono text-[11px] break-all">admin@rku.ac.in / Admin@123</div>
                        </div>
                        <button type="button" onclick="demoQuickLogin('Admin', 'admin@rku.ac.in', 'Admin@123')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md font-bold text-[11px] border-none cursor-pointer shrink-0 w-full sm:w-auto">
                            Demo Login
                        </button>
                    </div>
                    <div class="bg-white/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-gray-300">
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900">SubAdmin (Prof. Anjali Mehta)</div>
                            <div class="text-gray-600 font-mono text-[11px] break-all">subadmin@rku.ac.in / SubAdmin@123</div>
                        </div>
                        <button type="button" onclick="demoQuickLogin('SubAdmin', 'subadmin@rku.ac.in', 'SubAdmin@123')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-bold text-[11px] border-none cursor-pointer shrink-0 w-full sm:w-auto">
                            Demo Login
                        </button>
                    </div>
                    <div class="bg-white/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-gray-300">
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900">Student (Aarav Patel)</div>
                            <div class="text-gray-600 font-mono text-[11px] break-all">aarav.patel@rku.ac.in / Student@123</div>
                        </div>
                        <button type="button" onclick="demoQuickLogin('Student', 'aarav.patel@rku.ac.in', 'Student@123')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-bold text-[11px] border-none cursor-pointer shrink-0 w-full sm:w-auto">
                            Demo Login
                        </button>
                    </div>
                    <div class="bg-white/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-gray-300">
                        <div class="min-w-0">
                            <div class="font-bold text-gray-900">Placed Student (Priya Deshmukh)</div>
                            <div class="text-gray-600 font-mono text-[11px] break-all">priya.deshmukh@rku.ac.in / Student@123</div>
                        </div>
                        <button type="button" onclick="demoQuickLogin('Student', 'priya.deshmukh@rku.ac.in', 'Student@123')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold text-[11px] border-none cursor-pointer shrink-0 w-full sm:w-auto">
                            Demo Login
                        </button>
                    </div>
                </div>
            </div>`;

    const enhancedHtml = withSubAdminOption.replace(
        /(<div class="text-center mt-6 text-sm">[\s\S]*?<\/div>)/m,
        `$1\n${demoBox}`
    );

    const enhancedScripts = scripts.replace(
        `if (result.role === 'Admin') {`,
        `if (result.role === 'Admin' || result.role === 'SubAdmin') {`
    );

    return { html: enhancedHtml, scripts: enhancedScripts };
}

function enhanceAdminProfile() {
    let raw = readView('Admin/Profile.cshtml');
    raw = stripRazorHeader(raw);
    let html = sanitizePersonalInfo(cleanPaths(raw));

    // Add account role badge next to title
    html = html.replace(
        '<h1 class="text-2xl md:text-3xl font-bold text-red-600">Admin Profile</h1>',
        '<div class="flex flex-wrap items-center gap-3"><h1 class="text-2xl md:text-3xl font-bold text-red-600 m-0">Admin Profile</h1><span id="adminAccountRoleBadge" class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">MAIN ADMIN</span></div>'
    );

    // Add Role/Name fields to AddPortalUser & wire buttons
    html = html
        .replace(
            '<h2 class="text-center font-semibold mb-6 m-0">Add Another Person To Access A Portal</h2>\r\n            <div class="space-y-4">',
            `<h2 class="text-center font-semibold mb-4 m-0">Add Another Person To Access A Portal</h2>
            <div id="subAdminRbacNotice" class="hidden bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg p-4 text-xs leading-relaxed">
                <div class="font-bold mb-1"><i class="fas fa-shield-alt mr-1.5"></i>SubAdmin Permissions Active</div>
                <p class="m-0 mb-2">You can view Dashboard, manage Company JDs, approve/reject Students, manage Applications &amp; Interview Schedules, and edit your own profile.</p>
                <p class="m-0 font-semibold text-indigo-900">Restricted to Main Admin (TPO Head): Adding/removing SubAdmins &amp; deleting student or company records.</p>
            </div>
            <div id="addPortalUserForm" class="space-y-4">
                <div>
                    <label class="text-sm">Access Role</label>
                    <select id="newAdminRole" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm">
                        <option value="SubAdmin" selected>SubAdmin (T&amp;P Coordinator)</option>
                        <option value="Admin">Main Admin (Full Access)</option>
                    </select>
                </div>
                <div>
                    <label class="text-sm">Full Name</label>
                    <input id="newAdminFullName" type="text" placeholder="e.g. Prof. Karan Joshi" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />
                </div>`
        )
        .replace(
            '<h2 class="text-center font-semibold mb-6 m-0">Add Another Person To Access A Portal</h2>\n            <div class="space-y-4">',
            `<h2 class="text-center font-semibold mb-4 m-0">Add Another Person To Access A Portal</h2>
            <div id="subAdminRbacNotice" class="hidden bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg p-4 text-xs leading-relaxed">
                <div class="font-bold mb-1"><i class="fas fa-shield-alt mr-1.5"></i>SubAdmin Permissions Active</div>
                <p class="m-0 mb-2">You can view Dashboard, manage Company JDs, approve/reject Students, manage Applications &amp; Interview Schedules, and edit your own profile.</p>
                <p class="m-0 font-semibold text-indigo-900">Restricted to Main Admin (TPO Head): Adding/removing SubAdmins &amp; deleting student or company records.</p>
            </div>
            <div id="addPortalUserForm" class="space-y-4">
                <div>
                    <label class="text-sm">Access Role</label>
                    <select id="newAdminRole" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm">
                        <option value="SubAdmin" selected>SubAdmin (T&amp;P Coordinator)</option>
                        <option value="Admin">Main Admin (Full Access)</option>
                    </select>
                </div>
                <div>
                    <label class="text-sm">Full Name</label>
                    <input id="newAdminFullName" type="text" placeholder="e.g. Prof. Karan Joshi" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />
                </div>`
        )
        .replace(
            '<input placeholder="Enter college verified email" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />',
            '<input id="newAdminEmail" type="email" placeholder="Enter college verified email" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />'
        )
        .replace(
            '<input type="password" placeholder="Enter new password" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />',
            '<input id="newAdminPassword" type="password" placeholder="Enter new password" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />'
        )
        .replace(
            '<input type="password" placeholder="Re-enter new password" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />',
            '<input id="newAdminConfirmPassword" type="password" placeholder="Re-enter new password" class="w-full mt-1 p-2 rounded-md bg-white border border-gray-400 outline-none box-border text-sm" />'
        )
        .replace(
            `onclick="alert('User added successfully!')"`,
            `onclick="addAdminPortalUser()"`
        )
        .replace(
            `<button class="w-full border border-gray-400 bg-transparent py-3 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center justify-center gap-2 font-semibold text-gray-700 transition">\r\n                    Cancel`,
            `<button type="button" onclick="clearNewAdminForm()" class="w-full border border-gray-400 bg-transparent py-3 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center justify-center gap-2 font-semibold text-gray-700 transition">\n                    Cancel`
        )
        .replace(
            `<button class="w-full border border-gray-400 bg-transparent py-3 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center justify-center gap-2 font-semibold text-gray-700 transition">\n                    Cancel`,
            `<button type="button" onclick="clearNewAdminForm()" class="w-full border border-gray-400 bg-transparent py-3 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center justify-center gap-2 font-semibold text-gray-700 transition">\n                    Cancel`
        );

    html += `
    <!-- Portal Staff Management (Admins & SubAdmins) -->
    <div id="portalStaffSection" class="hidden mt-6 bg-[#d8cfc3] rounded-xl p-6 md:p-8 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
                <h2 class="text-lg font-bold text-gray-900 m-0">Portal Team (Admins &amp; SubAdmins)</h2>
                <p class="text-xs text-gray-600 m-0 mt-1">Manage T&amp;P Cell portal coordinators for this demo session (resets on logout).</p>
            </div>
            <span id="portalStaffCount" class="text-xs font-bold bg-white/80 text-gray-800 px-3 py-1 rounded-full self-start">0 Members</span>
        </div>
        <div class="overflow-x-auto bg-white/80 rounded-lg border border-gray-300">
            <table class="w-full text-left border-collapse text-sm">
                <thead class="bg-gray-100 text-[11px] uppercase tracking-wider text-gray-600 border-b border-gray-300">
                    <tr>
                        <th class="p-3">Name &amp; Title</th>
                        <th class="p-3">Email</th>
                        <th class="p-3">Role</th>
                        <th class="p-3">Status</th>
                        <th class="p-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody id="portalStaffTableBody"></tbody>
            </table>
        </div>
    </div>`;

    const scripts = `<script>
        document.addEventListener('DOMContentLoaded', async () => {
            if (!requireAuth('Admin')) return;
            const role = getAuthRole();
            const badge = document.getElementById('adminAccountRoleBadge');
            if (badge) {
                if (role === 'SubAdmin') {
                    badge.textContent = 'SUBADMIN (COORDINATOR)';
                    badge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200';
                } else {
                    badge.textContent = 'MAIN ADMIN';
                }
            }
            if (role === 'SubAdmin') {
                document.getElementById('addPortalUserForm')?.classList.add('hidden');
                document.getElementById('subAdminRbacNotice')?.classList.remove('hidden');
            } else {
                await loadPortalStaff();
            }
            await loadAdminProfile();
        });

        async function loadAdminProfile() {
            try {
                const res = await authFetch('/api/admin/profile');
                if (!res || !res.ok) return;
                const result = await res.json();
                if (result.success && result.data) {
                    applyAdminProfileToUi(result.data);
                }
            } catch (e) { console.error(e); }
        }

        function applyAdminProfileToUi(p) {
            const initials = (p.fullName || 'RK').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
            document.getElementById('adminInitialsDisplay').textContent = initials;
            document.getElementById('adminNameDisplay').textContent = p.fullName;
            document.getElementById('adminNameInput').value = p.fullName;
            document.getElementById('adminInfoNameInput').value = p.fullName;
            document.getElementById('adminRoleDisplay').textContent = p.roleTitle;
            document.getElementById('adminRoleInput').value = p.roleTitle;
            document.getElementById('adminInfoRoleInput').value = p.roleTitle;
            document.getElementById('adminEmpIdDisplay').textContent = p.employeeId;
            document.getElementById('adminEmpIdInput').value = p.employeeId;
            document.getElementById('adminDeptDisplay').textContent = p.department;
            document.getElementById('adminDeptInput').value = p.department;
            document.getElementById('adminLocDisplay').textContent = p.officeLocation;
            document.getElementById('adminLocInput').value = p.officeLocation;
            document.getElementById('adminMobileInput').value = p.mobileNumber;
            document.getElementById('adminEmailInput').value = p.email;
        }

        function validateAdminField(id) {
            const el = document.getElementById(id);
            if (!el) return true;
            return el.value.trim().length > 0;
        }

        async function toggleAdminProfileEdit() {
            const btn = document.getElementById('editAdminProfileBtn');
            const isEditing = btn.dataset.editing === 'true';
            const displays = document.querySelectorAll('.admin-profile-display');
            const inputs = document.querySelectorAll('.admin-profile-input');

            if (!isEditing) {
                btn.dataset.editing = 'true';
                btn.innerHTML = '<i class="fas fa-save"></i> SAVE PROFILE';
                btn.classList.remove('bg-red-600', 'hover:bg-red-700');
                btn.classList.add('bg-green-600', 'hover:bg-green-700');

                displays.forEach(d => { if (d.id !== 'adminInitialsDisplay') d.classList.add('hidden'); });
                inputs.forEach(inp => {
                    inp.classList.remove('hidden');
                    inp.removeAttribute('readonly');
                    inp.classList.remove('bg-gray-200', 'border-transparent');
                    inp.classList.add('bg-white', 'border-gray-400');
                });
            } else {
                const payload = {
                    fullName: document.getElementById('adminInfoNameInput').value.trim(),
                    roleTitle: document.getElementById('adminInfoRoleInput').value.trim(),
                    employeeId: document.getElementById('adminEmpIdInput').value.trim(),
                    department: document.getElementById('adminDeptInput').value.trim(),
                    officeLocation: document.getElementById('adminLocInput').value.trim(),
                    mobileNumber: document.getElementById('adminMobileInput').value.trim(),
                    email: document.getElementById('adminEmailInput').value.trim()
                };

                const res = await authFetch('/api/admin/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success) {
                    applyAdminProfileToUi(result.data);
                    btn.dataset.editing = 'false';
                    btn.innerHTML = '<i class="fas fa-edit"></i> EDIT PROFILE';
                    btn.classList.add('bg-red-600', 'hover:bg-red-700');
                    btn.classList.remove('bg-green-600', 'hover:bg-green-700');

                    displays.forEach(d => d.classList.remove('hidden'));
                    inputs.forEach(inp => {
                        if (inp.hasAttribute('readonly') || inp.id.startsWith('adminInfo') || inp.id === 'adminMobileInput' || inp.id === 'adminEmailInput') {
                            inp.setAttribute('readonly', 'readonly');
                            inp.classList.add('bg-gray-200', 'border-transparent');
                            inp.classList.remove('bg-white', 'border-gray-400');
                        } else {
                            inp.classList.add('hidden');
                        }
                    });
                    await loadPortalStaff();
                    alert(result.message);
                }
            }
        }

        async function loadPortalStaff() {
            const section = document.getElementById('portalStaffSection');
            if (!section || getAuthRole() !== 'Admin') return;
            try {
                const res = await authFetch('/api/admin/users');
                if (!res || !res.ok) return;
                const result = await res.json();
                if (!result.success) return;

                section.classList.remove('hidden');
                const staff = result.data || [];
                document.getElementById('portalStaffCount').textContent = staff.length + ' Members';
                const tbody = document.getElementById('portalStaffTableBody');
                tbody.innerHTML = staff.map(u => {
                    const roleBadge = u.role === 'Admin'
                        ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">Admin</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">SubAdmin</span>';
                    const statusBadge = u.isApproved
                        ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700">Active</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">Suspended</span>';
                    const actionHtml = u.isSelf
                        ? '<span class="text-xs text-gray-400 font-semibold">Current Session</span>'
                        : '<div class="flex justify-center gap-2">' +
                            '<button type="button" onclick="toggleStaffStatus(' + u.id + ')" class="px-2.5 py-1 rounded text-[11px] font-bold border-none cursor-pointer ' + (u.isApproved ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white') + '">' + (u.isApproved ? 'Suspend' : 'Activate') + '</button>' +
                            '<button type="button" onclick="deleteStaffUser(' + u.id + ', \\'' + (u.fullName || u.email).replace(/'/g, "\\\\'") + '\\')" class="px-2.5 py-1 rounded text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white border-none cursor-pointer">Remove</button>' +
                          '</div>';
                    return '<tr class="border-b border-gray-200">' +
                        '<td class="p-3"><div class="font-bold text-gray-900">' + u.fullName + '</div><div class="text-xs text-gray-500">' + (u.roleTitle || '') + '</div></td>' +
                        '<td class="p-3 font-mono text-xs text-gray-700">' + u.email + '</td>' +
                        '<td class="p-3">' + roleBadge + '</td>' +
                        '<td class="p-3">' + statusBadge + '</td>' +
                        '<td class="p-3 text-center">' + actionHtml + '</td>' +
                    '</tr>';
                }).join('');
            } catch (e) { console.error(e); }
        }

        async function toggleStaffStatus(id) {
            const res = await authFetch('/api/admin/users/' + id + '/toggle-status', { method: 'PUT' });
            const result = await res.json();
            alert(result.message);
            if (result.success) await loadPortalStaff();
        }

        async function deleteStaffUser(id, name) {
            if (!confirm('Remove portal access for ' + name + '? (Demo session only - recovers on logout)')) return;
            const res = await authFetch('/api/admin/users/' + id, { method: 'DELETE' });
            const result = await res.json();
            alert(result.message);
            if (result.success) await loadPortalStaff();
        }

        async function addAdminPortalUser() {
            const role = document.getElementById('newAdminRole').value;
            const fullName = document.getElementById('newAdminFullName').value.trim();
            const email = document.getElementById('newAdminEmail').value.trim();
            const password = document.getElementById('newAdminPassword').value;
            const confirmPassword = document.getElementById('newAdminConfirmPassword').value;
            const res = await authFetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, fullName, email, password, confirmPassword })
            });
            const result = await res.json();
            alert(result.message);
            if (result.success) {
                clearNewAdminForm();
                await loadPortalStaff();
            }
        }

        function clearNewAdminForm() {
            const roleEl = document.getElementById('newAdminRole');
            if (roleEl) roleEl.value = 'SubAdmin';
            const nameEl = document.getElementById('newAdminFullName');
            if (nameEl) nameEl.value = '';
            document.getElementById('newAdminEmail').value = '';
            document.getElementById('newAdminPassword').value = '';
            document.getElementById('newAdminConfirmPassword').value = '';
        }
    </script>`;

    return { html, scripts };
}

function enhanceCompanyManagement(html, scripts) {
    // Clean any stray closing divs after script
    const cleanedHtml = html.replace(/\s*<\/div>\s*<\/div>\s*$/m, '');
    // Add OnHold option to status dropdown and delete button support
    const withOnHoldFilter = cleanedHtml.replace(
        '<option value="rejected">Rejected</option>',
        '<option value="onhold">On Hold</option>\n                <option value="rejected">Rejected</option>'
    );

    const updatedScripts = scripts
        .replace(
            `else if (filterStatus === 'rejected') {\r\n                    statusMatch = (status === 'rejected');\r\n                }`,
            `else if (filterStatus === 'onhold') {\n                    statusMatch = (status === 'onhold');\n                } else if (filterStatus === 'rejected') {\n                    statusMatch = (status === 'rejected');\n                }`
        )
        .replace(
            `else if (filterStatus === 'rejected') {\n                    statusMatch = (status === 'rejected');\n                }`,
            `else if (filterStatus === 'onhold') {\n                    statusMatch = (status === 'onhold');\n                } else if (filterStatus === 'rejected') {\n                    statusMatch = (status === 'rejected');\n                }`
        )
        .replace(
            `\${badgeHtml}\r\n                    </div>`,
            `<div class="flex items-center gap-2">\${badgeHtml}<button onclick="deletePosting(\${c.id}, '\${(c.companyName || '').replace(/'/g, "\\\\'")}')" title="Delete JD" class="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-1"><i class="fas fa-trash-alt text-xs"></i></button></div>\n                    </div>`
        )
        .replace(
            `\${badgeHtml}\n                    </div>`,
            `<div class="flex items-center gap-2">\${badgeHtml}<button onclick="deletePosting(\${c.id}, '\${(c.companyName || '').replace(/'/g, "\\\\'")}')" title="Delete JD" class="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-1"><i class="fas fa-trash-alt text-xs"></i></button></div>\n                    </div>`
        )
        .replace(
            '</script>',
            `    async function deletePosting(id, name) {
            if (!confirm('Delete ' + name + ' job posting? (Demo session only - recovers on logout)')) return;
            const res = await authFetch('/api/company/job-postings/' + id, { method: 'DELETE' });
            if (!res) return;
            const result = await res.json();
            if (res.ok && result.success) {
                await loadJobPostings();
                filterCards();
            } else {
                alert(result.message || 'Permission denied.');
            }
        }
    </script>`
        );

    return { html: withOnHoldFilter, scripts: updatedScripts };
}

function wrapLayout({ title, bodyHtml, scriptsHtml = '', layoutType = 'root' }) {
    let shellBody = bodyHtml;

    if (layoutType === 'auth') {
        const authHeader = cleanPaths(readView('Shared/_AuthHeader.cshtml'));
        const footer = makeResponsiveFooter(cleanPaths(readView('Shared/_Footer.cshtml')));
        shellBody = `${authHeader}\n${bodyHtml}\n${footer}`;
    } else if (layoutType === 'admin') {
        const sidebar = renderSidebar('Shared/_AdminSidebar.cshtml');
        shellBody = `
<script>requireAuth('Admin');</script>
<div class="min-h-screen bg-gray-100">
    ${sidebar}
    <main class="p-4 sm:p-6 md:p-8 md:ml-64 min-w-0 max-w-full overflow-x-hidden">
        ${bodyHtml}
    </main>
</div>`;
    } else if (layoutType === 'student') {
        const sidebar = renderSidebar('Shared/_StudentSidebar.cshtml');
        shellBody = `
<script>requireAuth('Student');</script>
<div class="min-h-screen bg-gray-100">
    ${sidebar}
    <header class="absolute top-0 right-0 z-40 p-4 md:p-8 hidden md:flex justify-end">
        <a href="/StudProfile" class="px-5 py-2.5 rounded-md bg-[#e7000b] text-white font-bold cursor-pointer border-none shadow-sm hover:bg-red-700 transition-colors no-underline">
            Profile
        </a>
    </header>
    <main class="p-4 sm:p-6 md:p-8 md:ml-64 min-w-0 max-w-full overflow-x-hidden">
        ${bodyHtml}
    </main>
</div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - TP Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/css/site.css" />
    <style>body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; margin: 0; background-color: #ffffff; color: #333333; }</style>
    <script src="/js/demo-seed.js"></script>
    <script src="/js/demo-api.js"></script>
    <script src="/js/site.js"></script>
</head>
<body>
${shellBody}
${scriptsHtml}
</body>
</html>
`;
}

function writeOut(relOutPath, content) {
    const dest = path.join(outDir, relOutPath);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, content.replace(/\uFEFF/g, ''), 'utf8');
}

function copyDirRecursive(src, dest) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

// ===== BUILD =====
cleanDir(outDir);

// 1. Copy CSS and Images (explicitly EXCLUDING wwwroot/uploads!)
copyDirRecursive(path.join(wwwrootDir, 'css'), path.join(outDir, 'css'));
const responsiveCss = fs.readFileSync(path.join(srcDir, 'responsive.css'), 'utf8');
fs.appendFileSync(path.join(outDir, 'css', 'site.css'), '\n' + responsiveCss, 'utf8');
copyDirRecursive(path.join(wwwrootDir, 'images'), path.join(outDir, 'images'));

// 2. Copy demo-seed.js and demo-api.js
ensureDir(path.join(outDir, 'js'));
fs.copyFileSync(path.join(srcDir, 'demo-seed.js'), path.join(outDir, 'js', 'demo-seed.js'));
fs.copyFileSync(path.join(srcDir, 'demo-api.js'), path.join(outDir, 'js', 'demo-api.js'));

// 3. Build Vercel site.js (adds resetDemoDb on logout + SubAdmin RBAC support + route-alias active sidebar highlighting)
let siteJs = fs.readFileSync(path.join(wwwrootDir, 'js', 'site.js'), 'utf8');
siteJs = siteJs.replace(
    `function logout() {\r\n    localStorage.removeItem('tp_token');`,
    `function logout() {\n    if (typeof window.resetDemoDb === 'function') window.resetDemoDb();\n    localStorage.removeItem('tp_token');`
).replace(
    `function logout() {\n    localStorage.removeItem('tp_token');`,
    `function logout() {\n    if (typeof window.resetDemoDb === 'function') window.resetDemoDb();\n    localStorage.removeItem('tp_token');`
).replace(
    `    if (requiredRole && role !== requiredRole) {`,
    `    if (requiredRole && !(role === requiredRole || (requiredRole === 'Admin' && role === 'SubAdmin'))) {`
);

// Replace DOMContentLoaded active sidebar logic with complete route-alias + sub-page mapping
const newSidebarScript = `// ---- Active Sidebar Highlight ----
document.addEventListener('DOMContentLoaded', function () {
    const path = window.location.pathname.toLowerCase().replace(/\\.html$/, '');
    const aliasToCanonical = {
        '/admin/dashboard': '/admindashboard',
        '/admin/profile': '/adminprofile',
        '/admin/companymanagement': '/admincompanymanagement',
        '/admin/jddetail': '/admincompanymanagement',
        '/adminjddetail': '/admincompanymanagement',
        '/admin/studentsmanagement': '/adminstudentsmanagement',
        '/admin/manageapplications': '/adminmanageapplications',
        '/admin/interviewschedule': '/admininterviewschedule',
        '/admin/interviewscheduleform': '/admininterviewschedule',
        '/admininterviewscheduleform': '/admininterviewschedule',
        '/admin/placementhistory': '/adminplacementhistory',
        '/admin/changepassword': '/adminchangepassword',
        '/admin/forgotpassword': '/adminchangepassword',
        '/adminforgotpassword': '/adminchangepassword',

        '/student/dashboard': '/studdashboard',
        '/student/profile': '/studprofile',
        '/student/jobs': '/studjobs',
        '/student/jobdetails': '/studjobs',
        '/studjobdetails': '/studjobs',
        '/student/applications': '/studapplications',
        '/studentapplications': '/studapplications',
        '/student/interviewschedule': '/studinterviewschedule',
        '/student/placementhistory': '/studplacementhistory',
        '/student/changepassword': '/studchangepass',
        '/student/forgotpassword': '/studchangepass',
        '/studforgotpassword': '/studchangepass'
    };

    const canonicalPath = aliasToCanonical[path] || path;

    document.querySelectorAll('.sidebar-link').forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        if (href === canonicalPath || href === path) {
            link.classList.add('active', 'active-sidebar-link');
        }
    });

    // Inject active Role & User badge in Admin/SubAdmin sidebar
    const sidebarMenu = document.getElementById('sidebarMenu');
    const authRole = getAuthRole();
    const authName = getAuthName();
    if (sidebarMenu && (authRole === 'Admin' || authRole === 'SubAdmin')) {
        const badgeLi = document.createElement('li');
        badgeLi.className = 'mb-2 px-3 py-2 rounded-lg bg-white/75 border border-[#c4b5a6] text-xs list-none';
        const pillClass = authRole === 'Admin' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700';
        const roleLabel = authRole === 'Admin' ? 'MAIN ADMIN' : 'SUBADMIN';
        badgeLi.innerHTML = '<div class="flex items-center justify-between gap-2"><span class="font-bold text-gray-800 truncate">' + (authName || authRole) + '</span><span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ' + pillClass + '">' + roleLabel + '</span></div>';
        sidebarMenu.insertBefore(badgeLi, sidebarMenu.firstChild);
    }

    // Smooth scroll for anchor links on home page
    document.querySelectorAll('a[href^="/#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                e.preventDefault();
                const id = this.getAttribute('href').replace('/#', '');
                const target = document.getElementById(id);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});`;

siteJs = siteJs.replace(/\/\/ ---- Active Sidebar Highlight ----[\s\S]*$/m, newSidebarScript);
fs.writeFileSync(path.join(outDir, 'js', 'site.js'), siteJs, 'utf8');

// 4. Render Home Pages
writeOut('index.html', wrapLayout({ title: 'Home', bodyHtml: renderHomeIndex(), layoutType: 'root' }));

{
    let raw = stripRazorHeader(readView('Home/Register.cshtml'));
    const { html, scripts } = extractScriptsSection(raw);
    // Remove external Razorpay script tag (demo-api.js provides window.Razorpay shim with zero keys)
    const cleanHtml = cleanPaths(html).replace(/<script src="https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js"><\/script>/g, '');
    writeOut('register.html', wrapLayout({ title: 'Student Registration', bodyHtml: cleanHtml, scriptsHtml: scripts, layoutType: 'auth' }));
}

{
    let raw = stripRazorHeader(readView('Home/SubmitJd.cshtml'));
    const { html, scripts } = extractScriptsSection(raw);
    writeOut('submit-jd.html', wrapLayout({ title: 'Submit JD', bodyHtml: sanitizePersonalInfo(cleanPaths(html)), scriptsHtml: scripts, layoutType: 'auth' }));
}

// 5. Render Auth Pages
{
    let raw = stripRazorHeader(readView('Auth/Login.cshtml'));
    const { html, scripts } = extractScriptsSection(raw);
    const enhancedLogin = enhanceLoginHtml(cleanPaths(html), scripts);
    writeOut('auth/login.html', wrapLayout({ title: 'Login', bodyHtml: enhancedLogin.html, scriptsHtml: enhancedLogin.scripts, layoutType: 'auth' }));
}

for (const [view, out] of [
    ['Auth/ForgotPassword.cshtml', 'auth/forgot-password.html'],
    ['Auth/ChangePassword.cshtml', 'auth/change-password.html'],
    ['Auth/ResetPassword.cshtml', 'auth/reset-password.html']
]) {
    const raw = readView(view);
    const title = extractTitle(raw);
    const { html, scripts } = extractScriptsSection(stripRazorHeader(raw));
    writeOut(out, wrapLayout({ title, bodyHtml: cleanPaths(html), scriptsHtml: scripts, layoutType: 'auth' }));
}

// 6. Render Admin Pages
{
    const { html, scripts } = renderAdminDashboard();
    writeOut('admin/dashboard.html', wrapLayout({ title: 'Admin Dashboard', bodyHtml: html, scriptsHtml: scripts, layoutType: 'admin' }));
}
{
    const { html, scripts } = enhanceAdminProfile();
    writeOut('admin/profile.html', wrapLayout({ title: 'Admin Profile', bodyHtml: html, scriptsHtml: scripts, layoutType: 'admin' }));
}
{
    const raw = readView('Admin/CompanyManagement.cshtml');
    const { html, scripts } = extractScriptsSection(stripRazorHeader(raw));
    const enhanced = enhanceCompanyManagement(cleanPaths(html), scripts);
    writeOut('admin/company-management.html', wrapLayout({ title: 'Company Management', bodyHtml: enhanced.html, scriptsHtml: enhanced.scripts, layoutType: 'admin' }));
}
{
    const { html, scripts } = renderAdminJdDetail();
    writeOut('admin/jd-detail.html', wrapLayout({ title: 'JD Detail', bodyHtml: html, scriptsHtml: scripts, layoutType: 'admin' }));
}

for (const [view, out] of [
    ['Admin/StudentsManagement.cshtml', 'admin/students-management.html'],
    ['Admin/ManageApplications.cshtml', 'admin/manage-applications.html'],
    ['Admin/InterviewSchedule.cshtml', 'admin/interview-schedule.html'],
    ['Admin/InterviewScheduleForm.cshtml', 'admin/interview-schedule-form.html'],
    ['Admin/PlacementHistory.cshtml', 'admin/placement-history.html'],
    ['Admin/ChangePassword.cshtml', 'admin/change-password.html'],
    ['Admin/ForgotPassword.cshtml', 'admin/forgot-password.html']
]) {
    const raw = readView(view);
    const title = extractTitle(raw);
    let { html, scripts } = extractScriptsSection(stripRazorHeader(raw));
    if (view === 'Admin/StudentsManagement.cshtml') {
        scripts = scripts.replace(
            `if (!token || role !== 'Admin')`,
            `if (!token || (role !== 'Admin' && role !== 'SubAdmin'))`
        );
    }
    const cleanedHtml = cleanPaths(html).replace(/\s*<\/div>\s*$/m, (m) => view === 'Admin/PlacementHistory.cshtml' ? '' : m);
    writeOut(out, wrapLayout({ title, bodyHtml: cleanedHtml, scriptsHtml: scripts, layoutType: 'admin' }));
}

// 7. Render Student Pages
{
    const { html, scripts } = renderStudentDashboard();
    writeOut('student/dashboard.html', wrapLayout({ title: 'Student Dashboard', bodyHtml: html, scriptsHtml: scripts, layoutType: 'student' }));
}

for (const [view, out] of [
    ['Student/Profile.cshtml', 'student/profile.html'],
    ['Student/Jobs.cshtml', 'student/jobs.html'],
    ['Student/JobDetails.cshtml', 'student/job-details.html'],
    ['Student/Applications.cshtml', 'student/applications.html'],
    ['Student/InterviewSchedule.cshtml', 'student/interview-schedule.html'],
    ['Student/PlacementHistory.cshtml', 'student/placement-history.html'],
    ['Student/ChangePassword.cshtml', 'student/change-password.html'],
    ['Student/ForgotPassword.cshtml', 'student/forgot-password.html']
]) {
    const raw = readView(view);
    const title = view === 'Student/PlacementHistory.cshtml' ? 'Placement History' : extractTitle(raw);
    const { html, scripts } = extractScriptsSection(stripRazorHeader(raw));
    let cleanedHtml = cleanPaths(html);
    if (view === 'Student/Jobs.cshtml') {
        cleanedHtml = cleanedHtml.replace(/\s*<\/div>\s*<\/div>\s*$/m, '');
    } else if (view === 'Student/JobDetails.cshtml') {
        cleanedHtml = cleanedHtml.replace(/\s*<\/div>\s*$/m, '');
    }
    writeOut(out, wrapLayout({ title, bodyHtml: cleanedHtml, scriptsHtml: scripts, layoutType: 'student' }));
}

console.log('Vercel static bundle generated in vercel-public/');
