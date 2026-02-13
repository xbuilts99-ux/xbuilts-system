(function() {
    // 🔗 URL ของ Google Apps Script (ตรวจสอบให้แน่ใจว่าลงท้ายด้วย /exec)
    const API_URL = "https://script.google.com/macros/s/AKfycbxwNoDIQlJtyBm4Y8t_Ta7o7ncALFlPw61RFlEb6k8Sdsa1RM08Te4W8O1uPWnU5mrgXg/exec";

    let allRawData = [];
    let projects = JSON.parse(localStorage.getItem('xbuilts_projects_v3') || '["โครงการสร้างบ้าน A","ตกแต่งภายใน B"]');

    // 🖥️ อัปเดตสถานะการเชื่อมต่อบน UI
    window.updateConnectionStatus = function(status, message = '') {
        const el = document.getElementById('connectionStatus');
        if (!el) return;
        
        if (status === 'loading') {
            el.className = 'text-xs bg-yellow-50 text-yellow-600 px-4 py-1.5 rounded-full font-bold border border-yellow-200 loading-pulse';
            el.innerText = '● ' + (message || 'กำลังดึงข้อมูล...');
        } else if (status === 'success') {
            el.className = 'text-xs bg-green-50 text-green-600 px-4 py-1.5 rounded-full font-bold border border-green-200';
            el.innerText = '● เชื่อมต่อ Cloud สำเร็จ';
        } else {
            el.className = 'text-xs bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-bold border border-red-200';
            el.innerText = '● ' + (message || 'เชื่อมต่อล้มเหลว');
        }
    };

    // 📥 ฟังก์ชันดึงข้อมูล (GET)
    window.fetchData = async function() {
        updateConnectionStatus('loading', 'กำลังดึงข้อมูล...');
        try {
            // เพิ่ม Cache Buster เพื่อป้องกันข้อมูลเก่าค้าง
            const fetchUrl = `${API_URL}?t=${new Date().getTime()}`;
            
            const response = await fetch(fetchUrl, {
                method: "GET",
                mode: "cors", // ต้องเป็น cors เพื่ออ่านข้อมูล JSON
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && Array.isArray(data)) {
                window.allRawData = data; 
                window.processData(data);
                updateConnectionStatus('success');
            } else {
                throw new Error('โครงสร้างข้อมูลไม่ถูกต้อง');
            }

        } catch (error) {
            console.error("Connection Detailed Error:", error);
            // ตรวจสอบว่าเป็นปัญหา CORS หรือไม่
            if (error.message.includes('Failed to fetch')) {
                updateConnectionStatus('error', 'ติดปัญหา CORS/URL ผิด');
            } else {
                updateConnectionStatus('error', error.message);
            }
        }
    };

    // 📊 ฟังก์ชันประมวลผลข้อมูล (ปรับให้รองรับข้อมูลว่าง)
    window.processData = function(data) {
        const container = document.getElementById('transactionBody');
        const sourceData = data || window.allRawData;
        
        if (!container) return;
        
        if (!sourceData || sourceData.length < 2) {
            container.innerHTML = '<tr><td colspan="3" class="p-10 text-center text-slate-400 font-medium">ไม่พบข้อมูลในระบบ Cloud</td></tr>';
            return;
        }

        const rows = sourceData.slice(1); // ตัดหัวตาราง (Header) ออก
        const filter = document.getElementById('projectFilter').value;
        
        let stats = { income: 0, expense: 0, vat: 0, wht: 0 };
        let projectSummary = {}, monthlySummary = {}, taxMonthlySummary = {};

        container.innerHTML = '';

        // แสดงผลจากใหม่ไปเก่า
        [...rows].reverse().forEach(item => {
            // โครงสร้าง: [ID, Date, Type, Project, Category, Desc, Base, Vat, Wht, Total]
            const [id, date, type, proj, cat, desc, base, vat, wht, total] = item;
            
            const dateObj = new Date(date);
            const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            
            const valTotal = parseFloat(total) || 0;
            const valBase = parseFloat(base) || 0;
            const valVat = parseFloat(vat) || 0;
            const valWht = parseFloat(wht) || 0;

            // รวมยอดรายเดือน
            if (!monthlySummary[monthKey]) monthlySummary[monthKey] = { inc: 0, exp: 0 };
            if (type === 'income') monthlySummary[monthKey].inc += valTotal;
            else monthlySummary[monthKey].exp += valTotal;

            // รวมยอดภาษี
            if (!taxMonthlySummary[monthKey]) taxMonthlySummary[monthKey] = { base: 0, vat: 0, wht: 0 };
            if (type === 'expense') {
                taxMonthlySummary[monthKey].base += valBase;
                taxMonthlySummary[monthKey].vat += valVat;
                taxMonthlySummary[monthKey].wht += valWht;
            }

            // รวมยอดรายโครงการ
            if (!projectSummary[proj]) projectSummary[proj] = { inc: 0, exp: 0 };
            if (type === 'income') projectSummary[proj].inc += valTotal;
            else projectSummary[proj].exp += valTotal;

            // Filter ข้อมูลลงตาราง
            if (filter === 'all' || proj === filter) {
                if (type === 'income') stats.income += valTotal;
                else stats.expense += valTotal;
                
                stats.vat += valVat;
                stats.wht += valWht;

                container.innerHTML += `
                    <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                        <td class="p-4 text-[10px] text-slate-400 leading-tight">
                            ${dateObj.toLocaleDateString('th-TH')}<br>
                            ${dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td class="p-4">
                            <div class="font-bold text-slate-700 truncate max-w-[120px]">${proj}</div>
                            <div class="text-[10px] text-slate-400 font-bold uppercase">${cat}</div>
                        </td>
                        <td class="p-4 text-right">
                            <div class="font-bold ${type === 'income' ? 'text-blue-600' : 'text-red-500'}">
                                ${type === 'income' ? '+' : '-'} ฿${valTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            ${valVat > 0 ? `<div class="text-[9px] text-purple-400">VAT ฿${valVat.toFixed(2)}</div>` : ''}
                        </td>
                    </tr>`;
            }
        });

        // อัปเดตตัวเลขหลัก
        document.getElementById('totalIncome').innerText = '฿' + stats.income.toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('totalExpense').innerText = '฿' + stats.expense.toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('netProfit').innerText = '฿' + (stats.income - stats.expense).toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('avgMargin').innerText = stats.income > 0 ? (((stats.income - stats.expense) / stats.income) * 100).toFixed(1) + '%' : '0%';

        window.renderROI(projectSummary);
        window.renderMonthly(monthlySummary);
        window.renderTax(stats);
        window.renderTaxMonthly(taxMonthlySummary);
    };

    // 🎨 ฟังก์ชันช่วย Render (ROI, รายเดือน, ภาษี)
    window.renderROI = (map) => {
        const body = document.getElementById('roiBody');
        if (!body) return;
        body.innerHTML = Object.entries(map).sort((a, b) => b[1].inc - a[1].inc).map(([name, val]) => {
            const profit = val.inc - val.exp;
            const margin = val.inc > 0 ? (profit / val.inc * 100) : 0;
            return `<tr><td class="p-4 font-bold text-slate-700">${name}</td><td class="p-4 text-right">฿${val.inc.toLocaleString()}</td><td class="p-4 text-right text-red-400">฿${val.exp.toLocaleString()}</td><td class="p-4 text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">฿${profit.toLocaleString()}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded-full text-[10px] ${margin >= 20 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">Margin: ${margin.toFixed(1)}%</span></td></tr>`;
        }).join('');
    };

    window.renderMonthly = (map) => {
        const body = document.getElementById('monthlyBody');
        if (!body) return;
        body.innerHTML = Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([key, val]) => {
            const [y, m] = key.split('-');
            const label = new Date(y, m - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            return `<tr><td class="p-4 text-slate-600">${label}</td><td class="p-4 text-right text-blue-600">฿${val.inc.toLocaleString()}</td><td class="p-4 text-right text-red-400">฿${val.exp.toLocaleString()}</td><td class="p-4 text-right font-bold">฿${(val.inc - val.exp).toLocaleString()}</td></tr>`;
        }).join('');
    };

    window.renderTaxMonthly = (map) => {
        const body = document.getElementById('taxMonthlyBody');
        if (!body) return;
        body.innerHTML = Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([key, val]) => {
            const [y, m] = key.split('-');
            const label = new Date(y, m - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            return `<tr class="border-b border-slate-50"><td class="p-4 text-slate-700 font-bold">${label}</td><td class="p-4 text-right text-slate-500">฿${val.base.toLocaleString()}</td><td class="p-4 text-right text-blue-600 font-bold">฿${val.vat.toLocaleString()}</td><td class="p-4 text-right text-purple-600 font-bold">฿${val.wht.toLocaleString()}</td></tr>`;
        }).join('');
    };

    window.renderTax = (stats) => {
        const el = document.getElementById('taxContent');
        if (!el) return;
        el.innerHTML = `
            <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h4 class="text-blue-800 font-bold mb-2">🛍️ ภาษีซื้อสะสม (VAT)</h4>
                <p class="text-2xl font-black text-blue-700">฿${stats.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div class="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                <h4 class="text-purple-800 font-bold mb-2">✂️ หัก ณ ที่จ่ายสะสม (WHT)</h4>
                <p class="text-2xl font-black text-purple-700">฿${stats.wht.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h4 class="text-slate-800 font-bold mb-2">📈 ภาษีประหยัดได้ (นิติฯ)</h4>
                <p class="text-xl font-bold text-slate-600">฿${(stats.expense * 0.2).toLocaleString()}</p>
            </div>`;
    };

    // 📤 บันทึกข้อมูล (POST)
    const setupForm = () => {
        const form = document.getElementById('accountForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.innerText = '⌛ กำลังส่งข้อมูล...';

            const tx = window.calculateTax();
            const payload = {
                type: document.getElementById('type').value,
                project: document.getElementById('projectSelect').value,
                category: document.getElementById('category').value,
                description: document.getElementById('description').value,
                amount: tx.amount,
                vat: tx.vat,
                wht: tx.wht,
                net: tx.net
            };

            try {
                // สำหรับ Google Apps Script การใช้ no-cors ใน POST คือวิธีที่เสถียรที่สุด
                await fetch(API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                alert('บันทึกสำเร็จ! ข้อมูลจะปรากฏหลังจาก Cloud Sync (ประมาณ 2-3 วินาที)');
                form.reset();
                window.calculateTax();
                setTimeout(window.fetchData, 2000);
            } catch (err) {
                alert("บันทึกไม่สำเร็จ: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = 'บันทึกข้อมูล';
            }
        });
    };

    // ฟังก์ชันอื่นๆ ที่ต้องใช้ใน HTML
    window.calculateTax = function() {
        const base = parseFloat(document.getElementById('amount').value) || 0;
        const vat = document.getElementById('hasVat').checked ? base * 0.07 : 0;
        const whtRate = parseFloat(document.getElementById('whtRate').value) || 0;
        const wht = base * (whtRate / 100);
        const net = base + vat - wht;
        
        const vatEl = document.getElementById('displayVatText');
        const netEl = document.getElementById('displayNet');
        if (vatEl) vatEl.innerText = vat.toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (netEl) netEl.innerText = net.toLocaleString(undefined, { minimumFractionDigits: 2 });
        
        return { amount: base, vat: vat, wht: wht, net: net };
    };

    window.switchTab = function(tabName) {
        ['dashboard', 'analysis', 'tax'].forEach(id => {
            const view = document.getElementById('view-' + id);
            const tabBtn = document.getElementById('tab-' + id);
            if (view) view.classList.toggle('hidden', id !== tabName);
            if (tabBtn) tabBtn.className = id === tabName ? 
                'pb-2 font-bold nav-active whitespace-nowrap transition' : 
                'pb-2 font-bold text-slate-400 hover:text-slate-600 whitespace-nowrap transition';
        });
    };

    window.updateProjectOptions = function() {
        ['projectSelect', 'projectFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const current = el.value;
            el.innerHTML = id === 'projectFilter' ? '<option value="all">📁 ทุกโครงการ</option>' : '<option value="" disabled selected>-- เลือกโครงการ --</option>';
            projects.sort().forEach(p => el.innerHTML += `<option value="${p}">${p}</option>`);
            el.value = current || (id === 'projectFilter' ? 'all' : el.value);
        });
    };

    window.manageProjects = function() {
        const list = document.getElementById('projectList');
        if (!list) return;
        list.innerHTML = projects.map((p, i) => `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span class="text-sm font-medium text-slate-700">${p}</span>
                <button onclick="removeProject(${i})" class="text-red-400 hover:text-red-600 px-2 font-bold">ลบ</button>
            </div>`).join('');
        document.getElementById('projectModal').classList.remove('hidden');
    };

    window.addProject = function() {
        const n = document.getElementById('newProjectName').value.trim();
        if (n && !projects.includes(n)) {
            projects.push(n);
            localStorage.setItem('xbuilts_projects_v3', JSON.stringify(projects));
            document.getElementById('newProjectName').value = '';
            window.updateProjectOptions();
            window.manageProjects();
        }
    };

    window.removeProject = function(i) {
        if (confirm('ยืนยันการลบโครงการ?')) {
            projects.splice(i, 1);
            localStorage.setItem('xbuilts_projects_v3', JSON.stringify(projects));
            window.updateProjectOptions();
            window.manageProjects();
        }
    };

    window.closeProjectModal = function() {
        document.getElementById('projectModal').classList.add('hidden');
    };

    // 🚀 เมื่อโหลดหน้าเว็บ
    window.addEventListener('load', () => {
        window.updateProjectOptions();
        setupForm();
        window.fetchData();
    });
})();
