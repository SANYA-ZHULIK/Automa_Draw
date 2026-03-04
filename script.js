// === НАСТРОЙКИ SUPABASE ===
const SUPABASE_URL = 'https://ifodnbfkxucvurjsuwww.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sWBMPk3OUy8I28ouUCLJWA_azGgN1vQ';

// Глобальный клиент Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === НАСТРОЙКИ ПРИЛОЖЕНИЯ ===
const EDIT_PASSWORD = "admin123";
const AUTH_KEY = 'currentUser';
const DISCOUNT_CYCLE = 9;
const REFERRAL_BONUS_PERCENT = 10;
const AVG_PRICE = 20;

// Текущий пользователь
let currentUser = JSON.parse(sessionStorage.getItem(AUTH_KEY)) || null;
let currentTab = 'clients';
let selectedClientIndex = null;

// Данные (только в памяти)
let data = {
    clients: [],
    referrers: []
};

// Элементы страницы
const tableBody = document.getElementById('tableBody');
const referrersTableBody = document.getElementById('referrersTableBody');
const authSection = document.getElementById('authSection');
const modeIndicator = document.getElementById('modeIndicator');
const modeText = document.getElementById('modeText');
const editControlsClients = document.getElementById('editControlsClients');
const editControlsReferrers = document.getElementById('editControlsReferrers');
const clientsTableContainer = document.getElementById('clientsTableContainer');
const referrersTableContainer = document.getElementById('referrersTableContainer');
const personalView = document.getElementById('personalView');
const personalName = document.getElementById('personalName');
const personalStats = document.getElementById('personalStats');
const passwordInput = document.getElementById('passwordInput');
const clientNameInput = document.getElementById('clientNameInput');
const clientPasswordInput = document.getElementById('clientPasswordInput');
const referrerNameInput = document.getElementById('referrerNameInput');
const referrerPasswordInput = document.getElementById('referrerPasswordInput');
const referrerSelect = document.getElementById('referrerSelect');
const summaryStats = document.getElementById('summaryStats');
const adminFooterStats = document.getElementById('adminFooterStats');
const tabClients = document.getElementById('tabClients');
const tabReferrers = document.getElementById('tabReferrers');
const userSelect = document.getElementById('userSelect');
const loadingIndicator = document.getElementById('loadingIndicator');

// Элементы модальных окон
const passwordModal = document.getElementById('passwordModal');
const passwordModalTitle = document.getElementById('passwordModalTitle');
const passwordModalText = document.getElementById('passwordModalText');
let currentPasswordForCopy = '';

const workModal = document.getElementById('workModal');
const modalClientName = document.getElementById('modalClientName');
const workPrice = document.getElementById('workPrice');
const applyBonus = document.getElementById('applyBonus');
const bonusAmount = document.getElementById('bonusAmount');
const bonusCheckboxContainer = document.getElementById('bonusCheckboxContainer');

// === ПРИНУДИТЕЛЬНОЕ СКРЫТИЕ ВСЕХ ПАНЕЛЕЙ ПРИ ЗАГРУЗКЕ ===
(function() {
    // Скрываем все панели сразу после загрузки DOM
    setTimeout(function() {
        console.log('🔒 Принудительно скрываем все панели');
        
        if (clientsTableContainer) clientsTableContainer.classList.add('hidden');
        if (referrersTableContainer) referrersTableContainer.classList.add('hidden');
        if (editControlsClients) editControlsClients.classList.add('hidden');
        if (editControlsReferrers) editControlsReferrers.classList.add('hidden');
        if (personalView) personalView.classList.add('hidden');
        
        const tabs = document.querySelector('.tabs');
        if (tabs) tabs.classList.add('hidden');
        
        if (adminFooterStats) adminFooterStats.classList.add('hidden');
        if (summaryStats) summaryStats.classList.add('hidden');
    }, 10);
})();

// === ФУНКЦИИ ДЛЯ ИНДИКАТОРА ЗАГРУЗКИ ===
function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
}

function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

// === ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ВИДИМОСТЬЮ СТАТИСТИКИ ===
function showAdminFooterStats() {
    if (adminFooterStats) {
        adminFooterStats.classList.remove('hidden');
    }
}

function hideAdminFooterStats() {
    if (adminFooterStats) {
        adminFooterStats.classList.add('hidden');
    }
}

// === ФУНКЦИИ ДЛЯ РАБОТЫ СО СТАТИСТИКОЙ ===

// Функция обновления статистики клиента в clients_stats
async function updateClientStats(client) {
    try {
        const workHistory = client.workHistory || [];
        
        // Считаем статистику
        const totalWorks = workHistory.length;
        const fullPriceWorks = workHistory.filter(w => !w.isDiscounted).length;
        const discountWorks = workHistory.filter(w => w.isDiscounted).length;
        
        // Считаем total_bonus (сумма бонусов от работ этого клиента)
        let totalBonus = 0;
        workHistory.forEach(work => {
            if (work.bonusApplied && !work.isDiscounted) {
                totalBonus += work.price * (REFERRAL_BONUS_PERCENT / 100);
            }
        });
        
        const lastWork = workHistory.length > 0 
            ? new Date(workHistory[workHistory.length - 1].date).toISOString()
            : null;
        
        // Данные для сохранения
        const statsData = {
            client_name: client.name,
            total_works: totalWorks,
            full_price_works: fullPriceWorks,
            discount_works: discountWorks,
            total_bonus: totalBonus,
            last_work_date: lastWork,
            updated_at: new Date().toISOString()
        };
        
        console.log('📊 Обновляем статистику:', statsData);
        
        // Сохраняем в Supabase
        const { error } = await supabaseClient
            .from('clients_stats')
            .upsert(statsData, { 
                onConflict: 'client_name'
            });
        
        if (error) throw error;
        
        console.log('✅ Статистика обновлена для клиента', client.name);
        return true;
        
    } catch (err) {
        console.error('❌ Ошибка обновления статистики:', err);
        return false;
    }
}

// === ОСНОВНЫЕ ФУНКЦИИ ===
function initPage() {
    console.log('🚀 initPage() вызван, currentUser:', currentUser);
    
    // Скрываем все таблицы и панели при загрузке
    clientsTableContainer.classList.add('hidden');
    referrersTableContainer.classList.add('hidden');
    editControlsClients.classList.add('hidden');
    editControlsReferrers.classList.add('hidden');
    personalView.classList.add('hidden');
    
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.classList.add('hidden');
    
    hideAdminFooterStats();
    
    updateUserSelect();
    
    if (currentUser) {
        console.log('👤 Пользователь найден в sessionStorage:', currentUser);
        if (currentUser.type === 'admin') {
            enterAdminMode();
        } else {
            enterUserMode(currentUser);
        }
    } else {
        console.log('👤 Пользователь не найден, показываем форму входа');
        showAuthScreen();
    }
}

function updateUserSelect() {
    if (!userSelect) return;
    
    userSelect.innerHTML = '<option value="">Выберите пользователя</option>';
    
    data.clients.forEach((client, index) => {
    if (client.password) {
        const option = document.createElement('option');
        option.value = `client_${index}`;
        option.textContent = `Клиент: ${client.name}`;
        option.style.color = '#27ae60'; // Темно-зеленый
        option.style.fontWeight = '600';
        
        userSelect.appendChild(option);
    }
});

data.referrers.forEach((referrer, index) => {
    if (referrer.password) {
        const option = document.createElement('option');
        option.value = `referrer_${index}`;
        option.textContent = `Реферер: ${referrer.name}`;
        option.style.color = '#e67e22'; // Оранжевый
        option.style.fontWeight = '600';
        
        userSelect.appendChild(option);
    }
});
}

function showAuthScreen() {
    authSection.classList.remove('hidden');
    modeIndicator.className = 'mode-indicator view-mode';
    modeText.textContent = 'Режим просмотра • Войдите в систему';
    
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.classList.add('hidden');
    
    editControlsClients.classList.add('hidden');
    editControlsReferrers.classList.add('hidden');
    clientsTableContainer.classList.add('hidden');
    referrersTableContainer.classList.add('hidden');
    personalView.classList.add('hidden');
    
    // Скрываем статистику в футере
    hideAdminFooterStats();
    
    updateUserSelect();
}

function enterAdminMode() {
    console.log('👑 Вход в режим администратора');
    
    authSection.classList.add('hidden');
    modeIndicator.className = 'mode-indicator edit-mode';
    modeText.innerHTML = '<Режим администратора • Полный доступ';
    
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.classList.remove('hidden');
    
    personalView.classList.add('hidden');
    
    if (currentTab === 'clients') {
        clientsTableContainer.classList.remove('hidden');
        referrersTableContainer.classList.add('hidden');
        editControlsClients.classList.remove('hidden');
        editControlsReferrers.classList.add('hidden');
    } else {
        clientsTableContainer.classList.add('hidden');
        referrersTableContainer.classList.remove('hidden');
        editControlsClients.classList.add('hidden');
        editControlsReferrers.classList.remove('hidden');
    }
    
    updateReferrerSelect();
    renderClientsTable();
    renderReferrersTable();
    
    if (adminFooterStats) {
        updateSummaryStats();
        showAdminFooterStats();
    }
}

function enterUserMode(user) {
    console.log('👤 Вход в режим пользователя:', user);
    
    authSection.classList.add('hidden');
    modeIndicator.className = 'mode-indicator view-mode';
    
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.classList.add('hidden');
    
    editControlsClients.classList.add('hidden');
    editControlsReferrers.classList.add('hidden');
    clientsTableContainer.classList.add('hidden');
    referrersTableContainer.classList.add('hidden');
    personalView.classList.remove('hidden');
    
    // Скрываем статистику в футере для обычных пользователей
    hideAdminFooterStats();
    
    if (user.type === 'client') {
        modeText.innerHTML = `Вы вошли как клиент ${user.name}`;
        showClientPersonalView(user.index);
    } else if (user.type === 'referrer') {
        modeText.innerHTML = `Вы вошли как реферер ${user.name}`;
        showReferrerPersonalView(user.index);
    }
}

function showClientPersonalView(clientIndex) {
    const client = data.clients[clientIndex];
    personalName.textContent = client.name;
    personalName.style.textAlign = 'center';
    personalName.style.marginBottom = '30px';
    
    const stats = calculateClientStats(client);
    const referrer = client.referrerId ? data.referrers.find(r => String(r.id) === String(client.referrerId)) : null;
    
    // Статистика клиента
    const statsHtml = `
        <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin-bottom: 30px;">
            <div class="stat-card" style="text-align: center; padding: 20px; min-width: 200px;">
                <div class="stat-value" style="font-size: 2rem; font-weight: 800; color: #2c3e50;">${stats.totalWorks}</div>
                <div class="stat-label" style="color: #7f8c8d; font-weight: 600;">ВСЕГО РАБОТ</div>
            </div>
            <div class="stat-card" style="text-align: center; padding: 20px; min-width: 200px;">
                <div class="stat-value" style="font-size: 2rem; font-weight: 800; color: #2c3e50;">${stats.totalPaid}</div>
                <div class="stat-label" style="color: #7f8c8d; font-weight: 600;">ПО ПОЛНОЙ</div>
            </div>
            <div class="stat-card discount-stat" style="text-align: center; padding: 20px; min-width: 200px;">
                <div class="stat-value" style="font-size: 2rem; font-weight: 800; color: #2c3e50;">${stats.discountCount}</div>
                <div class="stat-label" style="color: #7f8c8d; font-weight: 600;">СО СКИДКОЙ</div>
            </div>
        </div>
    `;
    
    // Прогресс до скидки
    const progressHtml = `
        <div style="margin: 30px auto; text-align: center; max-width: 500px;">
            <h3 style="margin-bottom: 20px; color: #2c3e50;">Прогресс до следующей скидки</h3>
            <div class="progress-container" style="width: 100%;">
                <div class="progress-info" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: 600;">${stats.paidInCycle}/9 работ</span>
                    <span style="color: #7f8c8d;">${Math.round(stats.progressPercent)}%</span>
                </div>
                <div class="progress-bar-bg" style="height: 10px; background: #ecf0f1; border-radius: 10px; overflow: hidden;">
                    <div class="progress-bar" style="height: 100%; width: ${stats.progressPercent}%; background: linear-gradient(90deg, #6b6b6b, #b2b2b2);"></div>
                </div>
            </div>
            ${stats.isDiscountAvailable ? 
                '<p style="color: #27ae60; margin-top: 15px; font-weight: 600;">Скидка 50% доступна! Обратитесь к администратору.</p>' : 
                `<p style="color: #e67e22; margin-top: 15px;">Осталось работ: ${stats.worksUntilDiscount}</p>`
            }
        </div>
    `;
    
    // Информация о реферере
    const referrerHtml = referrer ? 
        `<p style="margin: 20px auto; text-align: center;">Вас привел: <strong style="color: #6b6b6b;">${referrer.name}</strong></p>` : 
        '';
    
    // История работ - ВСЕГДА ПОКАЗЫВАЕМ ТАБЛИЦУ
    const sortedWorks = client.workHistory && client.workHistory.length > 0 
        ? [...client.workHistory].sort((a, b) => new Date(b.date) - new Date(a.date))
        : [];
    
    let historyRows = '';
    if (sortedWorks.length > 0) {
        sortedWorks.forEach(work => {
            const date = new Date(work.date).toLocaleDateString('ru-RU');
            const type = work.isDiscounted ? 
                '<span style="color: #f39c12; font-weight: 600;">Со скидкой 50%</span>' : 
                '<span style="color: #27ae60; font-weight: 600;">Полная цена</span>';
            
            historyRows += `
                <tr style="border-bottom: 1px solid #eaeaea;">
                    <td style="padding: 12px 15px; text-align: center;">${date}</td>
                    <td style="padding: 12px 15px; text-align: center; font-weight: 600;">${work.price} BYN</td>
                    <td style="padding: 12px 15px; text-align: center;">${type}</td>
                </tr>
            `;
        });
    } else {
        // Пустая строка для отображения
        historyRows = `
            <tr>
                <td colspan="3" style="padding: 40px; text-align: center; color: #95a5a6;">
                    Пока нет выполненных работ
                </td>
            </tr>
        `;
    }
    
    const historyHtml = `
        <h3 style="margin: 40px auto 20px; text-align: center; color: #2c3e50;">История работ</h3>
        <div style="overflow-x: auto; display: flex; justify-content: center;">
            <table style="width: 100%; max-width: 800px; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin: 0 auto;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 15px; text-align: center; font-weight: 600; color: #7f8c8d;">Дата</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600; color: #7f8c8d;">Цена</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600; color: #7f8c8d;">Тип</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyRows}
                </tbody>
            </table>
        </div>
    `;
    
    personalStats.innerHTML = statsHtml + progressHtml + referrerHtml + historyHtml;
}

function showReferrerPersonalView(referrerIndex) {
    const referrer = data.referrers[referrerIndex];
    personalName.textContent = referrer.name;
    personalName.style.textAlign = 'center';
    personalName.style.marginBottom = '30px';
    
    const stats = calculateReferrerStats(referrer.id);
    
    // Статистика реферера
    const statsHtml = `
        <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin-bottom: 30px;">
            <div class="stat-card" style="text-align: center; padding: 20px; min-width: 200px;">
                <div class="stat-value" style="font-size: 2rem; font-weight: 800; color: #2c3e50;">${stats.clientsCount}</div>
                <div class="stat-label" style="color: #7f8c8d; font-weight: 600;">КЛИЕНТОВ</div>
            </div>
            <div class="stat-card" style="text-align: center; padding: 20px; min-width: 200px;">
                <div class="stat-value" style="font-size: 2rem; font-weight: 800; color: #2c3e50;">${stats.totalWorks}</div>
                <div class="stat-label" style="color: #7f8c8d; font-weight: 600;">РАБОТ</div>
            </div>
            <div class="stat-card bonus-stat" style="text-align: center; padding: 20px; min-width: 200px;">
                <div class="stat-value" style="font-size: 2rem; font-weight: 800; color: #3498db;">${stats.totalBonus.toFixed(2)} BYN</div>
                <div class="stat-label" style="color: #7f8c8d; font-weight: 600;">БОНУСОВ</div>
            </div>
        </div>
    `;
    
    // Статус выплат
    const payoutHtml = `
        <div style="background: #e8f5e9; padding: 25px; border-radius: 16px; margin: 30px auto; max-width: 600px; text-align: center;">
            <h3 style="margin-bottom: 20px; color: #2c3e50;">Статус выплат</h3>
            <div style="display: flex; justify-content: center; gap: 40px; flex-wrap: wrap;">
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #27ae60;">${stats.paidBonus.toFixed(2)} BYN</div>
                    <div style="color: #7f8c8d; margin-top: 5px;">Выплачено</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #e67e22;">${stats.toPay.toFixed(2)} BYN</div>
                    <div style="color: #7f8c8d; margin-top: 5px;">К выплате</div>
                </div>
            </div>
        </div>
    `;
    
    // Приведенные клиенты - ВСЕГДА ПОКАЗЫВАЕМ ТАБЛИЦУ
    const referredClients = data.clients.filter(c => String(c.referrerId) === String(referrer.id));
    
    let clientRows = '';
    if (referredClients.length > 0) {
        referredClients.forEach(client => {
            const clientBonus = calculateClientBonus(client);
            clientRows += `
                <tr style="border-bottom: 1px solid #eaeaea;">
                    <td style="padding: 12px 15px; text-align: center; font-weight: 500;">${client.name}</td>
                    <td style="padding: 12px 15px; text-align: center;">${(client.workHistory || []).length}</td>
                    <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: #27ae60;">${clientBonus.toFixed(2)} BYN</td>
                </tr>
            `;
        });
    } else {
        clientRows = `
            <tr>
                <td colspan="3" style="padding: 40px; text-align: center; color: #95a5a6;">
                    У вас пока нет приведенных клиентов
                </td>
            </tr>
        `;
    }
    
    const clientsHtml = `
        <h3 style="margin: 40px auto 20px; text-align: center; color: #2c3e50;">Приведенные клиенты</h3>
        <div style="overflow-x: auto; display: flex; justify-content: center;">
            <table style="width: 100%; max-width: 800px; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin: 0 auto;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 15px; text-align: center; font-weight: 600; color: #7f8c8d;">Клиент</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600; color: #7f8c8d;">Работ</th>
                        <th style="padding: 15px; text-align: center; font-weight: 600; color: #7f8c8d;">Бонусов</th>
                    </tr>
                </thead>
                <tbody>
                    ${clientRows}
                </tbody>
            </table>
        </div>
    `;
    
    personalStats.innerHTML = statsHtml + payoutHtml + clientsHtml;
}

function login() {
    const password = passwordInput.value.trim();
    
    if (!password) {
        showNotification('Введите пароль', 'error');
        return;
    }
    
    if (password === EDIT_PASSWORD) {
        currentUser = { type: 'admin', name: 'Администратор' };
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
        enterAdminMode();
        showNotification('Добро пожаловать, администратор!', 'success');
        passwordInput.value = '';
        return;
    }
    
    const selectedUser = userSelect.value;
    if (!selectedUser) {
        showNotification('Выберите пользователя', 'error');
        return;
    }
    
    const [type, index] = selectedUser.split('_');
    const userData = type === 'client' ? data.clients[parseInt(index)] : data.referrers[parseInt(index)];
    
    if (userData && userData.password === password) {
        currentUser = { 
            type: type, 
            index: parseInt(index), 
            name: userData.name,
            id: userData.id 
        };
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
        enterUserMode(currentUser);
        showNotification(`Добро пожаловать, ${userData.name}!`, 'success');
    } else {
        showNotification('Неверный пароль', 'error');
    }
    
    passwordInput.value = '';
}

function logout() {
    if (confirm('Выйти из системы?')) {
        currentUser = null;
        sessionStorage.removeItem(AUTH_KEY);
        showAuthScreen();
        showNotification('Вы вышли из системы', 'info');
    }
}

function switchTab(tab) {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    currentTab = tab;
    
    if (tab === 'clients') {
        tabClients.classList.add('active');
        tabReferrers.classList.remove('active');
        clientsTableContainer.classList.remove('hidden');
        referrersTableContainer.classList.add('hidden');
        editControlsClients.classList.remove('hidden');
        editControlsReferrers.classList.add('hidden');
    } else {
        tabClients.classList.remove('active');
        tabReferrers.classList.add('active');
        clientsTableContainer.classList.add('hidden');
        referrersTableContainer.classList.remove('hidden');
        editControlsClients.classList.add('hidden');
        editControlsReferrers.classList.remove('hidden');
    }
    
    updateSummaryStats();
}

function showNotification(message, type) {
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showPassword(password, name, type) {
    currentPasswordForCopy = password;
    passwordModalTitle.textContent = `Пароль ${type === 'client' ? 'клиента' : 'реферера'} ${name}`;
    passwordModalText.textContent = password || 'Пароль не установлен';
    passwordModal.classList.remove('hidden');
}

function closePasswordModal() {
    passwordModal.classList.add('hidden');
    currentPasswordForCopy = '';
}

function copyPasswordToClipboard() {
    if (currentPasswordForCopy) {
        navigator.clipboard.writeText(currentPasswordForCopy).then(() => {
            showNotification('Пароль скопирован в буфер обмена', 'success');
        }).catch(() => {
            showNotification('Ошибка при копировании', 'error');
        });
    }
}

function calculateClientStats(client) {
    const workHistory = client.workHistory || [];
    
    const sortedWorks = [...workHistory].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    let paidInCycle = 0;
    let discountCount = 0;
    let totalPaid = 0;
    
    for (let i = 0; i < sortedWorks.length; i++) {
        const work = sortedWorks[i];
        
        if (work.isDiscounted) {
            discountCount++;
            paidInCycle = 0;
        } else {
            totalPaid++;
            paidInCycle++;
        }
    }
    
    const isDiscountAvailable = paidInCycle === DISCOUNT_CYCLE;
    const worksUntilDiscount = isDiscountAvailable ? 0 : DISCOUNT_CYCLE - paidInCycle;
    const progressPercent = (paidInCycle / DISCOUNT_CYCLE) * 100;
    
    return {
        totalPaid,
        discountCount,
        totalWorks: workHistory.length,
        paidInCycle,
        worksUntilDiscount,
        progressPercent,
        isDiscountAvailable
    };
}

// Функция применения скидки
async function applyDiscount(clientIndex) {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    const client = data.clients[clientIndex];
    const workHistory = client.workHistory || [];
    
    const stats = calculateClientStats(client);
    if (!stats.isDiscountAvailable) {
        showNotification(`Скидка еще не доступна. Нужно ${DISCOUNT_CYCLE} оплаченных работ подряд.`, 'error');
        return;
    }
    
    const discountWork = {
        date: new Date().toISOString(),
        price: AVG_PRICE / 2,
        bonusApplied: false,
        isDiscounted: true
    };
    
    showLoading();
    
    try {
        console.log('📝 Применяем скидку для клиента:', client.name);
        
        // 1. Добавляем скидочную работу в историю
        workHistory.push(discountWork);
        client.paidFull = workHistory.filter(w => !w.isDiscounted).length;
        
        // 2. Сохраняем клиента
        const { error: clientError } = await supabaseClient
            .from('clients')
            .update({
                work_history: workHistory
            })
            .eq('name', client.name);
        
        if (clientError) throw clientError;
        console.log('✅ Клиент обновлен');
        
        // 3. Обновляем статистику клиента
        await updateClientStats(client);
        
        showNotification(`Скидка 50% применена к новой работе!`, 'success');
        
        renderClientsTable();
        renderReferrersTable();
        updateSummaryStats();
        
    } catch (err) {
        console.error('❌ Ошибка при применении скидки:', err);
        showNotification('Ошибка при сохранении скидки', 'error');
    } finally {
        hideLoading();
    }
}

// Функция добавления работы
async function confirmAddWork() {
    if (!currentUser || currentUser.type !== 'admin' || selectedClientIndex === null) return;
    
    const client = data.clients[selectedClientIndex];
    const price = parseFloat(workPrice.value) || AVG_PRICE;
    
    const stats = calculateClientStats(client);
    
    if (stats.isDiscountAvailable) {
        showNotification('Сначала примените скидку! У клиента доступна скидка 50%.', 'error');
        closeWorkModal();
        return;
    }
    
    let applyBonusChecked = false;
    let referrer = null;
    if (client.referrerId) {
        referrer = data.referrers.find(r => String(r.id) === String(client.referrerId));
        if (referrer) {
            applyBonusChecked = applyBonus.checked;
        }
    }
    
    const workEntry = {
        date: new Date().toISOString(),
        price: price,
        bonusApplied: applyBonusChecked,
        isDiscounted: false
    };
    
    showLoading();
    
    try {
        console.log('📝 Добавляем работу для клиента:', client.name);
        
        // 1. Добавляем работу в историю клиента
        if (!client.workHistory) {
            client.workHistory = [];
        }
        
        client.workHistory.push(workEntry);
        client.paidFull = client.workHistory.filter(w => !w.isDiscounted).length;
        
        // 2. Сохраняем клиента в Supabase
        const { error: clientError } = await supabaseClient
            .from('clients')
            .update({
                work_history: client.workHistory
            })
            .eq('name', client.name);
        
        if (clientError) throw clientError;
        console.log('✅ Клиент обновлен');
        
        // 3. Обновляем статистику клиента
        await updateClientStats(client);
        
        // 4. Если нужно начислить бонус рефереру
        if (client.referrerId && applyBonusChecked && referrer) {
            const bonus = price * (REFERRAL_BONUS_PERCENT / 100);
            showNotification(`Рефереру ${referrer.name} начислен бонус ${bonus.toFixed(2)} BYN`, 'success');
        }
        
        renderClientsTable();
        renderReferrersTable();
        updateSummaryStats();
        
        closeWorkModal();
        
        showNotification(`Работа добавлена для ${client.name}`, 'success');
        
    } catch (err) {
        console.error('❌ Ошибка при добавлении работы:', err);
        showNotification('Ошибка при сохранении работы: ' + (err.message || 'неизвестная ошибка'), 'error');
    } finally {
        hideLoading();
    }
}

function calculateClientBonus(client) {
    if (!client.referrerId) return 0;
    
    const workHistory = client.workHistory || [];
    let totalBonus = 0;
    
    workHistory.forEach(work => {
        if (work.bonusApplied) {
            totalBonus += work.price * (REFERRAL_BONUS_PERCENT / 100);
        }
    });
    
    return totalBonus;
}

function calculateReferrerStats(referrerId) {
    const referredClients = data.clients.filter(c => String(c.referrerId) === String(referrerId));
    const clientsCount = referredClients.length;
    
    let totalWorks = 0;
    let totalBonus = 0;
    
    referredClients.forEach(client => {
        totalWorks += (client.workHistory || []).length;
        totalBonus += calculateClientBonus(client);
    });
    
    const referrer = data.referrers.find(r => String(r.id) === String(referrerId));
    const paidBonus = referrer ? referrer.paidBonus || 0 : 0;
    const toPay = totalBonus - paidBonus;
    
    return {
        clientsCount,
        totalWorks,
        totalBonus,
        paidBonus,
        toPay
    };
}

function updateSummaryStats() {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    // Проверяем, что элемент существует
    if (!adminFooterStats) {
        console.error('❌ adminFooterStats не найден в DOM');
        return;
    }
    
    var totalClients = data.clients.length;
    var totalReferrers = data.referrers.length;
    
    var totalWorks = 0;
    var totalPaidWorks = 0;
    var totalDiscountWorks = 0;
    var totalBonus = 0;
    var totalPaidBonus = 0;
    
    for (var i = 0; i < data.clients.length; i++) {
        var client = data.clients[i];
        var stats = calculateClientStats(client);
        totalWorks += stats.totalWorks;
        totalPaidWorks += stats.totalPaid;
        totalDiscountWorks += stats.discountCount;
    }
    
    for (var j = 0; j < data.referrers.length; j++) {
        var referrer = data.referrers[j];
        var stats = calculateReferrerStats(referrer.id);
        totalBonus += stats.totalBonus;
        totalPaidBonus += stats.paidBonus;
    }
    
    if (currentTab === 'clients') {
        adminFooterStats.innerHTML = `
            <div class="summary-stat">
                <div class="summary-value">${totalClients}</div>
                <div class="summary-label">Клиентов</div>
            </div>
            <div class="summary-stat">
                <div class="summary-value">${totalWorks}</div>
                <div class="summary-label">Работ</div>
            </div>
            <div class="summary-stat">
                <div class="summary-value">${totalPaidWorks}</div>
                <div class="summary-label">По полной</div>
            </div>
            <div class="summary-stat">
                <div class="summary-value">${totalDiscountWorks}</div>
                <div class="summary-label">Со скидкой</div>
            </div>
        `;
    } else {
        adminFooterStats.innerHTML = `
            <div class="summary-stat">
                <div class="summary-value">${totalReferrers}</div>
                <div class="summary-label">Рефереров</div>
            </div>
            <div class="summary-stat">
                <div class="summary-value">${totalBonus.toFixed(2)} BYN</div>
                <div class="summary-label">Бонусов</div>
            </div>
            <div class="summary-stat">
                <div class="summary-value">${totalPaidBonus.toFixed(2)} BYN</div>
                <div class="summary-label">Выплачено</div>
            </div>
            <div class="summary-stat">
                <div class="summary-value">${(totalBonus - totalPaidBonus).toFixed(2)} BYN</div>
                <div class="summary-label">К выплате</div>
            </div>
        `;
    }
}

function updateReferrerSelect() {
    if (!referrerSelect) return;
    
    referrerSelect.innerHTML = '<option value="">— Не привели (сам пришел) —</option>';
    
    data.referrers.forEach((referrer) => {
        const option = document.createElement('option');
        option.value = referrer.id;
        option.textContent = referrer.name;
        referrerSelect.appendChild(option);
    });
}

function openWorkModal(clientIndex) {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    selectedClientIndex = clientIndex;
    const client = data.clients[clientIndex];
    
    modalClientName.textContent = `Добавление работы для ${client.name}`;
    workPrice.value = AVG_PRICE;
    
    if (client.referrerId) {
        const referrer = data.referrers.find(r => String(r.id) === String(client.referrerId));
        if (referrer) {
            bonusCheckboxContainer.style.display = 'block';
            updateBonusAmount();
        } else {
            bonusCheckboxContainer.style.display = 'none';
        }
    } else {
        bonusCheckboxContainer.style.display = 'none';
    }
    
    workModal.classList.remove('hidden');
}

function closeWorkModal() {
    workModal.classList.add('hidden');
    selectedClientIndex = null;
}

function updateBonusAmount() {
    const price = parseFloat(workPrice.value) || AVG_PRICE;
    const bonus = price * (REFERRAL_BONUS_PERCENT / 100);
    bonusAmount.innerHTML = `💰 Бонус: ${bonus.toFixed(2)} BYN`;
}

function renderClientsTable() {
    if (!tableBody) return;
    
    tableBody.innerHTML = '';

    if (data.clients.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <div class="empty-icon">📁</div>
                    <div class="empty-title">Нет данных о клиентах</div>
                    <div class="empty-text">
                        Добавьте первого клиента с помощью формы выше
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    data.clients.forEach((client, index) => {
        const stats = calculateClientStats(client);
        
        // 2. Убрал снизу фамилии надпись "привел"
        let referrerInfo = '<span style="color: #95a5a6;">—</span>';
        
        if (client.referrerId) {
            const referrer = data.referrers.find(r => String(r.id) === String(client.referrerId));
            if (referrer) {
                referrerInfo = `
                    <div style="color: #7f8c8d; font-weight: 500;">${referrer.name}</div>
                `;
            } else {
                client.referrerId = null;
            }
        }
        
        // 3 и 4. Статус с серым цветом текста
        let statusHtml;
        if (stats.isDiscountAvailable) {
            statusHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span style="color: #2acf18; font-weight: 500;">Скидка готова!</span>
                    <button class="action-btn action-discount" onclick="applyDiscount(${index})" style="margin-left: 0; padding: 6px 12px; min-width: auto; background: #7f8c8d; color: white; border: none; border-radius: 30px; cursor: pointer;">
                        Применить 50%
                    </button>
                </div>
            `;
        } else {
            statusHtml = `
                <div style="color: #7f8c8d; font-weight: 500; text-align: center;">
                    Нужно еще работ до получения скидки: ${stats.worksUntilDiscount}
                </div>
            `;
        }
        
        const progressHtml = `
            <div class="progress-container">
                <div class="progress-info">
                    <span>${stats.paidInCycle}/9</span>
                    <span>${Math.round(stats.progressPercent)}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar" style="width: ${stats.progressPercent}%"></div>
                </div>
            </div>
        `;
        
        const passwordHtml = `
            <div class="password-cell" style="text-align: center;">
                ${client.password ? 
                    `<button class="btn btn-info btn-sm" onclick="showPassword('${client.password}', '${client.name}', 'client')" style="padding: 5px 10px; font-size: 0.8rem; border-radius: 20px;">
                         Показать
                    </button>` : 
                    '<span style="color: #95a5a6;">❌</span>'
                }
            </div>
        `;
        
        const actionsHtml = `
            <div class="actions" style="justify-content: center;">
                <button class="action-btn action-add" onclick="openWorkModal(${index})" title="Добавить работу">
                    <span>➕</span>
                </button>
                <button class="action-btn action-remove" onclick="removeClient(${index})">
                    <span>🗑️</span>
                </button>
            </div>
        `;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="client-info" style="text-align: left;">
                <div class="client-name">${client.name}</div>
                <div class="client-id">ID: ${String(index + 1).padStart(3, '0')}</div>
            </td>
            <td style="text-align: center;">${passwordHtml}</td>
            <td style="text-align: center;">
                <div class="stat-card" style="display: inline-block;">
                    <div class="stat-value">${stats.totalWorks}</div>
                </div>
            </td>
            <!-- 1. Центровка для графы "по полной" -->
            <td style="text-align: center;">
                <div class="stat-card" style="display: inline-block;">
                    <div class="stat-value">${stats.totalPaid}</div>
                </div>
            </td>
            <td style="text-align: center;">
    <div class="stat-card discount-stat" style="display: inline-block; ${stats.discountCount === 0 ? 'opacity: 0.6;' : ''}">
        <div class="stat-value">${stats.discountCount}</div>
    </div>
</td>
            <td style="text-align: center;">
                ${referrerInfo}
            </td>
            <!-- 3. Центровка для графы "статус" -->
            <td style="text-align: center; vertical-align: middle;">
                ${statusHtml}
            </td>
            <td style="text-align: center;">${progressHtml}</td>
            <td style="text-align: center;">${actionsHtml}</td>
        `;

        tableBody.appendChild(row);
    });
}

function renderReferrersTable() {
    if (!referrersTableBody) return;
    
    referrersTableBody.innerHTML = '';

    if (data.referrers.length === 0) {
        referrersTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-icon">🤝</div>
                    <div class="empty-title">Нет данных о реферерах</div>
                    <div class="empty-text">
                        Добавьте первого реферера с помощью формы выше
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    data.referrers.forEach((referrer, index) => {
        const stats = calculateReferrerStats(referrer.id);
        
        const passwordHtml = `
            <div class="password-cell">
                ${referrer.password ? 
                    `<button class="btn btn-info btn-sm" onclick="showPassword('${referrer.password}', '${referrer.name}', 'referrer')" style="padding: 5px 10px; font-size: 0.8rem; border-radius: 20px;">
                         Показать
                    </button>` : 
                    '<span style="color: #95a5a6;">❌</span>'
                }
            </div>
        `;
        
        const actionsHtml = `
            <div class="actions">
                ${stats.toPay > 0 ? `
                    <button class="action-btn action-pay" onclick="payBonus('${referrer.id}')">
                        <span>💰</span>
                    </button>
                ` : ''}
                <button class="action-btn action-remove" onclick="removeReferrer('${referrer.id}')">
                    <span>🗑️</span>
                </button>
            </div>
        `;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="client-info">
                <div class="client-name">${referrer.name}</div>
                <div class="client-id">ID: ${String(index + 1).padStart(3, '0')}</div>
            </td>
            <td>${passwordHtml}</td>
            <td>
                <div class="stat-card">
                    <div class="stat-value">${stats.clientsCount}</div>
                </div>
            </td>
            <td>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalWorks}</div>
                </div>
            </td>
            <td>
                <div class="stat-card bonus-stat">
                    <div class="stat-value">${stats.totalBonus.toFixed(1)}</div>
                </div>
            </td>
            <td>
                <div class="stat-card" style="background: #e8f5e9;">
                    <div class="stat-value" style="color: #2e7d32;">${stats.paidBonus.toFixed(1)}</div>
                </div>
            </td>
            <td>
                <div class="stat-card" style="background: #fff3e0;">
                    <div class="stat-value" style="color: #ef6c00;">${stats.toPay.toFixed(1)}</div>
                </div>
            </td>
            <td>${actionsHtml}</td>
        `;

        referrersTableBody.appendChild(row);
    });
}

// Функция добавления клиента с сохранением в Supabase
async function addNewClient() {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    const name = clientNameInput.value.trim();
    const password = clientPasswordInput.value.trim();
    
    if (!name) {
        showNotification('Введите имя клиента', 'error');
        return;
    }
    
    if (!password) {
        showNotification('Введите пароль для клиента', 'error');
        return;
    }
    
    const exists = data.clients.some(client => 
        client.name.toLowerCase() === name.toLowerCase()
    );
    
    if (exists) {
        showNotification('Клиент с таким именем уже существует', 'error');
        return;
    }
    
    const referrerId = referrerSelect.value || null;
    
    showLoading();
    
    try {
        const { data: newClient, error } = await supabaseClient
            .from('clients')
            .insert([{
                name: name,
                password: password,
                work_history: [],
                referrer_id: referrerId
            }])
            .select();
        
        if (error) throw error;
        
        const clientToAdd = {
            name,
            password,
            paidFull: 0,
            referrerId,
            workHistory: []
        };
        
        data.clients.push(clientToAdd);
        
        // Создаем начальную статистику для нового клиента
        await updateClientStats(clientToAdd);
        
        clientNameInput.value = '';
        clientPasswordInput.value = '';
        referrerSelect.value = '';
        
        renderClientsTable();
        renderReferrersTable();
        updateSummaryStats();
        updateReferrerSelect();
        updateUserSelect();
        
        showNotification(`Клиент "${name}" добавлен в облако`, 'success');
        
    } catch (err) {
        console.error('Ошибка при добавлении клиента:', err);
        showNotification('Ошибка при добавлении клиента', 'error');
    } finally {
        hideLoading();
    }
    
    clientNameInput.focus();
}

// Функция добавления реферера с сохранением в Supabase
async function addNewReferrer() {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    const name = referrerNameInput.value.trim();
    const password = referrerPasswordInput.value.trim();
    
    if (!name) {
        showNotification('Введите имя реферера', 'error');
        return;
    }
    
    if (!password) {
        showNotification('Введите пароль для реферера', 'error');
        return;
    }
    
    const exists = data.referrers.some(r => 
        r.name.toLowerCase() === name.toLowerCase()
    );
    
    if (exists) {
        showNotification('Реферер с таким именем уже существует', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const { data: newReferrer, error } = await supabaseClient
            .from('referrers')
            .insert([{
                name: name,
                password: password,
                paid_bonus: 0
            }])
            .select();
        
        if (error) throw error;
        
        const referrerToAdd = {
            name,
            password,
            id: newReferrer[0].id || String(Date.now()) + String(Math.random()).substring(2, 8),
            paidBonus: 0
        };
        
        data.referrers.push(referrerToAdd);
        
        referrerNameInput.value = '';
        referrerPasswordInput.value = '';
        
        updateReferrerSelect();
        renderReferrersTable();
        renderClientsTable();
        updateSummaryStats();
        updateUserSelect();
        
        showNotification(`Реферер "${name}" добавлен в облако`, 'success');
        
    } catch (err) {
        console.error('Ошибка при добавлении реферера:', err);
        showNotification('Ошибка при добавлении реферера', 'error');
    } finally {
        hideLoading();
    }
    
    referrerNameInput.focus();
}

// Функция удаления клиента
async function removeClient(clientIndex) {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    const client = data.clients[clientIndex];
    const clientName = client.name;
    
    if (!confirm(`Удалить клиента "${clientName}" и всю статистику?`)) return;
    
    showLoading();
    
    try {
        // Удаляем клиента
        const { error } = await supabaseClient
            .from('clients')
            .delete()
            .eq('name', clientName);
        
        if (error) throw error;
        
        // Удаляем статистику клиента
        await supabaseClient
            .from('clients_stats')
            .delete()
            .eq('client_name', clientName);
        
        data.clients.splice(clientIndex, 1);
        
        renderClientsTable();
        renderReferrersTable();
        updateSummaryStats();
        updateReferrerSelect();
        updateUserSelect();
        
        showNotification(`Клиент "${clientName}" удален из облака`, 'success');
        
    } catch (err) {
        console.error('Ошибка при удалении клиента:', err);
        showNotification('Ошибка при удалении клиента', 'error');
    } finally {
        hideLoading();
    }
}

// Функция удаления реферера
async function removeReferrer(referrerId) {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    const idStr = String(referrerId);
    const referrer = data.referrers.find(r => String(r.id) === idStr);
    
    if (!referrer) {
        showNotification('Реферер не найден', 'error');
        return;
    }
    
    if (!confirm(`Удалить реферера "${referrer.name}"?`)) return;
    
    const hasClients = data.clients.some(c => String(c.referrerId) === idStr);
    
    if (hasClients) {
        if (!confirm(`Реферер "${referrer.name}" привел клиентов. При удалении связь с клиентами потеряется. Продолжить?`)) {
            return;
        }
    }
    
    showLoading();
    
    try {
        const { error } = await supabaseClient
            .from('referrers')
            .delete()
            .eq('name', referrer.name);
        
        if (error) throw error;
        
        if (hasClients) {
            for (const client of data.clients) {
                if (String(client.referrerId) === idStr) {
                    client.referrerId = null;
                    
                    await supabaseClient
                        .from('clients')
                        .update({ referrer_id: null })
                        .eq('name', client.name);
                    
                    // Обновляем статистику клиента
                    await updateClientStats(client);
                }
            }
        }
        
        data.referrers = data.referrers.filter(r => String(r.id) !== idStr);
        
        updateReferrerSelect();
        renderReferrersTable();
        renderClientsTable();
        updateSummaryStats();
        updateUserSelect();
        
        showNotification(`Реферер "${referrer.name}" удален из облака`, 'success');
        
    } catch (err) {
        console.error('Ошибка при удалении реферера:', err);
        showNotification('Ошибка при удалении реферера', 'error');
    } finally {
        hideLoading();
    }
}

// Функция выплаты бонуса
async function payBonus(referrerId) {
    if (!currentUser || currentUser.type !== 'admin') return;
    
    const referrer = data.referrers.find(r => String(r.id) === String(referrerId));
    const stats = calculateReferrerStats(referrerId);
    
    if (stats.toPay <= 0) {
        showNotification('Нет бонусов к выплате', 'error');
        return;
    }
    
    if (!confirm(`Выплатить бонус ${stats.toPay.toFixed(2)} BYN рефереру ${referrer.name}?`)) return;
    
    showLoading();
    
    try {
        const newPaidBonus = (referrer.paidBonus || 0) + stats.toPay;
        
        const { error } = await supabaseClient
            .from('referrers')
            .update({ paid_bonus: newPaidBonus })
            .eq('name', referrer.name);
        
        if (error) throw error;
        
        referrer.paidBonus = newPaidBonus;
        
        showNotification(`Бонус выплачен: ${stats.toPay.toFixed(2)} BYN`, 'success');
        
        renderReferrersTable();
        updateSummaryStats();
        
    } catch (err) {
        console.error('Ошибка при выплате бонуса:', err);
        showNotification('Ошибка при выплате бонуса', 'error');
    } finally {
        hideLoading();
    }
}

// Функция для просмотра статистики всех клиентов
async function showAllStats() {
    try {
        const { data: stats, error } = await supabaseClient
            .from('clients_stats')
            .select('*')
            .order('total_works', { ascending: false });
        
        if (error) throw error;
        
        console.log('Статистика клиентов:');
        console.table(stats.map(s => ({
            'Клиент': s.client_name,
            'Всего работ': s.total_works,
            'По полной': s.full_price_works,
            'Со скидкой': s.discount_works,
            'Принес бонусов': s.total_bonus + ' BYN',
            'Последняя работа': s.last_work_date ? new Date(s.last_work_date).toLocaleDateString() : '-'
        })));
        
        return stats;
        
    } catch (err) {
        console.error('❌ Ошибка загрузки статистики:', err);
    }
}

function handlePasswordEnter(event) {
    if (event.key === 'Enter') login();
}

// Загрузка данных из Supabase при старте
function loadFromSupabase() {
    showLoading();
    
    console.log('☁️ Загружаем данные из Supabase...');
    
    // Загружаем рефереров
    supabaseClient
        .from('referrers')
        .select('*')
        .then(function(response) {
            if (response.error) throw response.error;
            
            if (response.data && response.data.length > 0) {
                data.referrers = response.data.map(function(r) {
                    return {
                        name: r.name,
                        password: r.password,
                        paidBonus: r.paid_bonus || 0,
                        id: r.id || String(Date.now()) + String(Math.random()).substring(2, 8)
                    };
                });
                console.log('✅ Загружено ' + response.data.length + ' рефереров');
            }
            
            // Загружаем клиентов
            return supabaseClient
                .from('clients')
                .select('*');
        })
        .then(function(response) {
            if (response.error) throw response.error;
            
            if (response.data && response.data.length > 0) {
                data.clients = response.data.map(function(c) {
                    return {
                        name: c.name,
                        password: c.password,
                        workHistory: c.work_history || [],
                        referrerId: c.referrer_id,
                        paidFull: (c.work_history || []).filter(function(w) { 
                            return !w.isDiscounted; 
                        }).length
                    };
                });
                console.log('✅ Загружено ' + response.data.length + ' клиентов');
            }
            
            // Обновляем интерфейс ТОЛЬКО если пользователь уже вошел
            if (currentUser) {
                console.log('👤 Пользователь уже в системе, обновляем интерфейс');
                updateUserSelect();
                renderClientsTable();
                renderReferrersTable();
                
                if (adminFooterStats) {
                    updateSummaryStats();
                }
                
                updateReferrerSelect();
                
                // Показываем нужный режим
                if (currentUser.type === 'admin') {
                    enterAdminMode();
                } else {
                    enterUserMode(currentUser);
                }
            } else {
                console.log('👤 Пользователь не в системе, просто обновляем селект');
                updateUserSelect();
                // Показываем форму входа
                showAuthScreen();
            }
            
            hideLoading();
        })
        .catch(function(err) {
            console.error('❌ Ошибка загрузки из Supabase:', err);
            showNotification('Ошибка загрузки из облака', 'error');
            hideLoading();
        });
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM загружен, начинаем инициализацию');
    
    // Сначала принудительно скрываем всё
    if (clientsTableContainer) clientsTableContainer.classList.add('hidden');
    if (referrersTableContainer) referrersTableContainer.classList.add('hidden');
    if (editControlsClients) editControlsClients.classList.add('hidden');
    if (editControlsReferrers) editControlsReferrers.classList.add('hidden');
    if (personalView) personalView.classList.add('hidden');
    
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.classList.add('hidden');
    
    if (adminFooterStats) adminFooterStats.classList.add('hidden');
    
    // Показываем форму входа
    if (authSection) authSection.classList.remove('hidden');
    
    // Загружаем данные
    loadFromSupabase();
});

// Обработчики для модального окна
workPrice.addEventListener('input', updateBonusAmount);
applyBonus.addEventListener('change', updateBonusAmount);

// Делаем функции доступными глобально для onclick в HTML
window.switchTab = switchTab;
window.openWorkModal = openWorkModal;
window.closeWorkModal = closeWorkModal;
window.confirmAddWork = confirmAddWork;
window.applyDiscount = applyDiscount;
window.removeClient = removeClient;
window.removeReferrer = removeReferrer;
window.addNewClient = addNewClient;
window.addNewReferrer = addNewReferrer;
window.payBonus = payBonus;
window.handlePasswordEnter = handlePasswordEnter;
window.login = login;
window.logout = logout;
window.showPassword = showPassword;
window.closePasswordModal = closePasswordModal;
window.copyPasswordToClipboard = copyPasswordToClipboard;
window.showAllStats = showAllStats;