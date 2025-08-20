// Скрипт для работы с реферальной системой на Tilda (исправленная версия)
(function() {
  console.log('Скрипт реферальной системы активирован (исправленная версия)');
  
  // URL нашего сервера
  const SERVER_URL = 'https://supabase-auth-production-4267.up.railway.app';
  
  // Безопасное сохранение в localStorage
  function safeSetItem(key, value) {
    try {
      // Сохраняем оригинальный метод setItem
      const originalSetItem = localStorage.setItem;
      
      // Проверяем, не был ли метод уже переопределен
      if (originalSetItem.toString().includes('sendEmailToServer')) {
        console.log('Обнаружен переопределенный метод localStorage.setItem, используем безопасный метод');
        
        // Используем прямое присваивание, чтобы избежать вызова переопределенного метода
        localStorage[key] = value;
      } else {
        // Используем оригинальный метод
        originalSetItem.call(localStorage, key, value);
      }
    } catch (error) {
      console.error('Ошибка при сохранении в localStorage:', error);
    }
  }
  
  // Безопасное получение из localStorage
  function safeGetItem(key) {
    try {
      // Сохраняем оригинальный метод getItem
      const originalGetItem = localStorage.getItem;
      
      // Проверяем, не был ли метод уже переопределен
      if (originalGetItem.toString().includes('sendEmailToServer')) {
        console.log('Обнаружен переопределенный метод localStorage.getItem, используем безопасный метод');
        
        // Используем прямое обращение, чтобы избежать вызова переопределенного метода
        return localStorage[key];
      } else {
        // Используем оригинальный метод
        return originalGetItem.call(localStorage, key);
      }
    } catch (error) {
      console.error('Ошибка при получении из localStorage:', error);
      return null;
    }
  }
  
  // Функция для получения параметров из URL
  function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }
  
  // Функция для сохранения реферального кода в localStorage
  function saveReferralCode() {
    const referralCode = getUrlParameter('ref');
    if (referralCode) {
      safeSetItem('referralCode', referralCode);
      console.log('Сохранен реферальный код:', referralCode);
      
      // Обновляем все ссылки на странице, добавляя реферальный код
      updateLinksWithReferralCode(referralCode);
      
      // Проверяем, нужно ли перенаправить на страницу регистрации
      const redirect = getUrlParameter('redirect');
      if (redirect === 'signup' || redirect === 'register' || redirect === 'registration' || redirect === '1') {
        // Перенаправляем на страницу регистрации
        window.location.href = '/members/signup';
      }
    }
  }
  
  // Функция для обновления всех ссылок на странице, добавляя реферальный код
  function updateLinksWithReferralCode(referralCode) {
    const links = document.querySelectorAll('a');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      
      // Проверяем, что ссылка ведет на наш домен
      if (href && (href.includes('aida.kg') || href.startsWith('/') || href.startsWith('#'))) {
        // Если ссылка уже содержит параметр ref, не меняем ее
        if (href.includes('ref=')) {
          return;
        }
        
        // Добавляем реферальный код к ссылке
        if (href.includes('?')) {
          link.setAttribute('href', href + '&ref=' + referralCode);
        } else if (href.startsWith('#')) {
          // Не меняем якорные ссылки
          return;
        } else {
          link.setAttribute('href', href + '?ref=' + referralCode);
        }
      }
    });
  }
  
  // Функция для перехвата форм регистрации и добавления реферального кода
  function setupFormInterceptors() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(function(form) {
      // Проверяем, не был ли уже установлен перехватчик
      if (form.dataset.refIntercepted) {
        return;
      }
      
      // Помечаем форму как перехваченную
      form.dataset.refIntercepted = 'true';
      
      // Добавляем скрытое поле для реферального кода, если его еще нет
      if (!form.querySelector('input[name="referralCode"]')) {
        const referralCodeField = document.createElement('input');
        referralCodeField.type = 'hidden';
        referralCodeField.name = 'referralCode';
        form.appendChild(referralCodeField);
        
        // Заполняем поле реферальным кодом, если он есть в localStorage
        const savedReferralCode = safeGetItem('referralCode');
        if (savedReferralCode) {
          referralCodeField.value = savedReferralCode;
          console.log('Добавлено скрытое поле с реферальным кодом:', savedReferralCode);
        }
      }
      
      // Добавляем обработчик события отправки формы
      form.addEventListener('submit', function(e) {
        // Ищем поле email в форме
        const emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"], input[placeholder*="email"]');
        
        // Обновляем значение скрытого поля реферального кода
        const referralCodeField = form.querySelector('input[name="referralCode"]');
        const savedReferralCode = safeGetItem('referralCode');
        if (referralCodeField && savedReferralCode) {
          referralCodeField.value = savedReferralCode;
        }
        
        if (emailField && emailField.value) {
          const email = emailField.value.trim();
          const referralCode = safeGetItem('referralCode');
          
          if (referralCode) {
            console.log('Перехвачена отправка формы с email:', email, 'и реферальным кодом:', referralCode);
            
            // Отправляем запрос на регистрацию с реферальным кодом
            fetch(`${SERVER_URL}/register-with-referral`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: email,
                name: form.querySelector('input[name="name"], input[name*="name"], input[placeholder*="name"]')?.value || '',
                referralCode: referralCode
              })
            })
            .then(response => response.json())
            .then(data => {
              console.log('Ответ от сервера:', data);
              
              if (!data.error) {
                // Сохраняем данные пользователя
                safeSetItem('userData', JSON.stringify(data.user));
                safeSetItem('userEmail', email);
                
                // Показываем уведомление об успешной регистрации
                showNotification('Вы успешно зарегистрированы по реферальной программе!', 'success');
              }
            })
            .catch(error => {
              console.error('Ошибка при регистрации:', error);
            });
          }
        }
      });
    });
  }
  
  // Функция для отображения реферальной информации пользователя
  function displayReferralInfo() {
    const userEmail = safeGetItem('userEmail');
    
    if (userEmail) {
      fetch(`${SERVER_URL}/referral-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail
        })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.error) {
          console.log('Получена реферальная информация:', data);
          
          // Обновляем элементы с реферальной информацией
          document.querySelectorAll('.referral-code').forEach(el => {
            el.textContent = data.user.referral_code || '';
          });
          
          document.querySelectorAll('.referral-balance').forEach(el => {
            el.textContent = (data.user.balance_kgs || 0).toFixed(2) + ' KGS';
          });
          
          document.querySelectorAll('.referral-total-earned').forEach(el => {
            el.textContent = (data.user.total_earned || 0).toFixed(2) + ' KGS';
          });
          
          document.querySelectorAll('.referral-level1-count').forEach(el => {
            el.textContent = data.referral_stats.level_1_count || 0;
          });
          
          document.querySelectorAll('.referral-level2-count').forEach(el => {
            el.textContent = data.referral_stats.level_2_count || 0;
          });
          
          document.querySelectorAll('.referral-level3-count').forEach(el => {
            el.textContent = data.referral_stats.level_3_count || 0;
          });
          
          document.querySelectorAll('.referral-total-count').forEach(el => {
            el.textContent = data.referral_stats.total_referrals || 0;
          });
          
          // Обновляем реферальную ссылку
          document.querySelectorAll('.referral-link').forEach(el => {
            const baseUrl = window.location.origin;
            const referralLink = `${baseUrl}?ref=${data.user.referral_code}`;
            el.textContent = referralLink;
            el.setAttribute('href', referralLink);
          });
          
          // Обновляем кнопку копирования реферальной ссылки
          document.querySelectorAll('.copy-referral-link').forEach(el => {
            el.addEventListener('click', function() {
              const baseUrl = window.location.origin;
              const referralLink = `${baseUrl}?ref=${data.user.referral_code}`;
              
              // Копируем ссылку в буфер обмена
              navigator.clipboard.writeText(referralLink)
                .then(() => {
                  showNotification('Реферальная ссылка скопирована!', 'success');
                })
                .catch(err => {
                  console.error('Ошибка при копировании:', err);
                  showNotification('Не удалось скопировать ссылку', 'error');
                });
            });
          });
          
          // Показываем блок с реферальной информацией
          document.querySelectorAll('.referral-info-block').forEach(el => {
            el.style.display = 'block';
          });
          
          // Если есть список рефералов, заполняем его
          const referralsList = document.querySelector('.referrals-list');
          if (referralsList && data.level_1_referrals && data.level_1_referrals.length > 0) {
            referralsList.innerHTML = '';
            
            data.level_1_referrals.forEach(referral => {
              const referralItem = document.createElement('div');
              referralItem.className = 'referral-item';
              
              const referralName = document.createElement('div');
              referralName.className = 'referral-name';
              referralName.textContent = referral.name || referral.email;
              
              const referralDate = document.createElement('div');
              referralDate.className = 'referral-date';
              referralDate.textContent = new Date(referral.created_at).toLocaleDateString();
              
              referralItem.appendChild(referralName);
              referralItem.appendChild(referralDate);
              referralsList.appendChild(referralItem);
            });
          }
          
          // Если есть список транзакций, заполняем его
          const transactionsList = document.querySelector('.transactions-list');
          if (transactionsList && data.recent_transactions && data.recent_transactions.length > 0) {
            transactionsList.innerHTML = '';
            
            data.recent_transactions.forEach(tx => {
              const txItem = document.createElement('div');
              txItem.className = 'transaction-item';
              
              const txAmount = document.createElement('div');
              txAmount.className = 'transaction-amount';
              txAmount.textContent = tx.amount.toFixed(2) + ' KGS';
              
              const txLevel = document.createElement('div');
              txLevel.className = 'transaction-level';
              txLevel.textContent = 'Уровень ' + tx.level;
              
              const txDate = document.createElement('div');
              txDate.className = 'transaction-date';
              txDate.textContent = new Date(tx.date).toLocaleDateString();
              
              const txDesc = document.createElement('div');
              txDesc.className = 'transaction-description';
              txDesc.textContent = tx.description;
              
              txItem.appendChild(txAmount);
              txItem.appendChild(txLevel);
              txItem.appendChild(txDate);
              txItem.appendChild(txDesc);
              transactionsList.appendChild(txItem);
            });
          }
        }
      })
      .catch(error => {
        console.error('Ошибка при получении реферальной информации:', error);
      });
    }
  }
  
  // Функция для отображения уведомления
  function showNotification(message, type = 'info') {
    let notification = document.getElementById('referral-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'referral-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.padding = '15px';
      notification.style.borderRadius = '5px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      notification.style.zIndex = '9999';
      notification.style.display = 'none';
      document.body.appendChild(notification);
    }
    
    // Устанавливаем цвет в зависимости от типа уведомления
    if (type === 'success') {
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#F44336';
      notification.style.color = 'white';
    } else if (type === 'warning') {
      notification.style.backgroundColor = '#FF9800';
      notification.style.color = 'white';
    } else {
      notification.style.backgroundColor = '#2196F3';
      notification.style.color = 'white';
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }
  
  // Функция для создания виджета реферальной программы
  function createReferralWidget() {
    // Проверяем, существует ли уже виджет
    if (document.getElementById('referral-widget')) {
      return;
    }
    
    // Создаем виджет
    const widget = document.createElement('div');
    widget.id = 'referral-widget';
    widget.className = 'referral-widget';
    widget.innerHTML = `
      <div class="referral-widget-header">
        <h3>Реферальная программа</h3>
        <button class="referral-widget-toggle">▼</button>
      </div>
      <div class="referral-widget-content">
        <div class="referral-info-block" style="display: none;">
          <p>Ваш реферальный код: <strong class="referral-code"></strong></p>
          <p>Ваша реферальная ссылка: <a href="#" class="referral-link"></a></p>
          <button class="copy-referral-link">Копировать ссылку</button>
          
          <div class="referral-stats">
            <div class="referral-stat-item">
              <div class="stat-label">Баланс:</div>
              <div class="stat-value referral-balance">0 KGS</div>
            </div>
            <div class="referral-stat-item">
              <div class="stat-label">Всего заработано:</div>
              <div class="stat-value referral-total-earned">0 KGS</div>
            </div>
            <div class="referral-stat-item">
              <div class="stat-label">Рефералы 1 уровня:</div>
              <div class="stat-value referral-level1-count">0</div>
            </div>
            <div class="referral-stat-item">
              <div class="stat-label">Рефералы 2 уровня:</div>
              <div class="stat-value referral-level2-count">0</div>
            </div>
            <div class="referral-stat-item">
              <div class="stat-label">Рефералы 3 уровня:</div>
              <div class="stat-value referral-level3-count">0</div>
            </div>
            <div class="referral-stat-item">
              <div class="stat-label">Всего рефералов:</div>
              <div class="stat-value referral-total-count">0</div>
            </div>
          </div>
          
          <h4>Ваши рефералы</h4>
          <div class="referrals-list"></div>
          
          <h4>Последние транзакции</h4>
          <div class="transactions-list"></div>
        </div>
      </div>
    `;
    
    // Добавляем стили для виджета
    const style = document.createElement('style');
    style.textContent = `
      .referral-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background-color: white;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9998;
        overflow: hidden;
        transition: height 0.3s ease;
      }
      
      .referral-widget.collapsed .referral-widget-content {
        display: none;
      }
      
      .referral-widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background-color: #2196F3;
        color: white;
      }
      
      .referral-widget-header h3 {
        margin: 0;
        font-size: 16px;
      }
      
      .referral-widget-toggle {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
      }
      
      .referral-widget-content {
        padding: 15px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .referral-stats {
        margin-top: 15px;
      }
      
      .referral-stat-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      }
      
      .stat-label {
        color: #666;
      }
      
      .stat-value {
        font-weight: bold;
        color: #333;
      }
      
      .copy-referral-link {
        display: block;
        margin: 10px 0;
        padding: 8px 12px;
        background-color: #2196F3;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      }
      
      .referral-item, .transaction-item {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
      }
      
      .referral-name, .transaction-amount {
        font-weight: bold;
      }
      
      .referral-date, .transaction-date, .transaction-level, .transaction-description {
        font-size: 12px;
        color: #666;
        margin-top: 3px;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(widget);
    
    // Добавляем обработчик для сворачивания/разворачивания виджета
    const toggleButton = widget.querySelector('.referral-widget-toggle');
    toggleButton.addEventListener('click', function() {
      widget.classList.toggle('collapsed');
      toggleButton.textContent = widget.classList.contains('collapsed') ? '▲' : '▼';
    });
    
    // Обновляем информацию в виджете
    displayReferralInfo();
  }
  
  // Функция для проверки и выполнения перенаправления
  function checkAndRedirect() {
    // Получаем параметры из URL
    const referralCode = getUrlParameter('ref');
    const redirect = getUrlParameter('redirect');
    
    console.log('Проверка перенаправления. Реферальный код:', referralCode, 'Параметр redirect:', redirect);
    
    // Если есть реферальный код и параметр redirect
    if (referralCode && (redirect === 'signup' || redirect === 'register' || redirect === 'registration' || redirect === '1')) {
      console.log('Условия для перенаправления выполнены');
      
      // Сохраняем реферальный код перед перенаправлением
      safeSetItem('referralCode', referralCode);
      
      // Определяем URL для перенаправления
      let redirectUrl = '/members/signup';
      
      // Проверяем, существует ли на сайте страница /members/signup
      const signupLinks = document.querySelectorAll('a[href*="/members/signup"], a[href*="/signup"]');
      if (signupLinks.length > 0) {
        // Используем первую найденную ссылку на регистрацию
        redirectUrl = signupLinks[0].getAttribute('href');
        console.log('Найдена ссылка на регистрацию:', redirectUrl);
      }
      
      console.log('Перенаправляем на:', redirectUrl);
      
      // Выполняем перенаправление с небольшой задержкой
      setTimeout(function() {
        window.location.href = redirectUrl;
      }, 500);
      
      return true;
    }
    
    return false;
  }
  
  // Немедленная проверка перенаправления
  (function() {
    const referralCode = getUrlParameter('ref');
    const redirect = getUrlParameter('redirect');
    
    console.log('Немедленная проверка перенаправления. Реферальный код:', referralCode, 'Параметр redirect:', redirect);
    
    // Если есть реферальный код и параметр redirect
    if (referralCode && (redirect === 'signup' || redirect === 'register' || redirect === 'registration' || redirect === '1')) {
      console.log('Условия для немедленного перенаправления выполнены');
      
      // Сохраняем реферальный код перед перенаправлением
      safeSetItem('referralCode', referralCode);
      
      // Выполняем перенаправление
      window.location.href = '/members/signup';
    }
  })();

  // Инициализация
  function init() {
    // Проверяем, нужно ли выполнить перенаправление
    if (checkAndRedirect()) {
      // Если выполнено перенаправление, не выполняем остальные действия
      return;
    }
    
    // Сохраняем реферальный код из URL
    saveReferralCode();
    
    // Устанавливаем перехватчики форм
    setupFormInterceptors();
    
    // Создаем виджет реферальной программы
    createReferralWidget();
    
    // Отображаем реферальную информацию
    displayReferralInfo();
  }
  
  // Запускаем инициализацию при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Повторно запускаем перехватчики форм через интервалы
  setInterval(setupFormInterceptors, 3000);
})();