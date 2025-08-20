// Скрипт для работы с реферальной системой на Tilda
(function() {
  console.log('Скрипт реферальной системы активирован');
  
  // URL нашего сервера
  const SERVER_URL = 'https://supabase-auth-production-4267.up.railway.app';
  
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
      localStorage.setItem('referralCode', referralCode);
      console.log('Сохранен реферальный код:', referralCode);
      
      // Обновляем все ссылки на странице, добавляя реферальный код
      updateLinksWithReferralCode(referralCode);
      
      // Проверяем, нужно ли перенаправить на страницу регистрации
      const redirect = getUrlParameter('redirect');
      console.log('Параметр redirect:', redirect);
      
      // Проверяем разные варианты параметра redirect
      if (redirect === 'signup' || redirect === 'register' || redirect === 'registration' || redirect === '1') {
        console.log('Перенаправляем на страницу регистрации...');
        
        // Добавляем небольшую задержку перед перенаправлением
        setTimeout(function() {
          // Проверяем, существует ли страница /members/signup
          fetch('/members/signup', { method: 'HEAD' })
            .then(response => {
              if (response.ok) {
                // Если страница существует, перенаправляем на нее
                window.location.href = '/members/signup';
              } else {
                // Если страница не существует, пробуем другие варианты
                window.location.href = '/signup';
              }
            })
            .catch(error => {
              console.error('Ошибка при проверке страницы регистрации:', error);
              // В случае ошибки, пробуем прямое перенаправление
              window.location.href = '/members/signup';
            });
        }, 500);
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
      
      // Добавляем обработчик события отправки формы
      form.addEventListener('submit', function(e) {
        // Ищем поле email в форме
        const emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"], input[placeholder*="email"]');
        
        if (emailField && emailField.value) {
          const email = emailField.value.trim();
          const referralCode = localStorage.getItem('referralCode');
          
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
                referralCode: referralCode
              })
            })
            .then(response => response.json())
            .then(data => {
              console.log('Ответ от сервера:', data);
              
              if (!data.error) {
                // Сохраняем данные пользователя
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('userEmail', email);
                
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
    const userEmail = localStorage.getItem('userEmail');
    
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
        </div>
        
        <div class="guest-content">
          <p>Войдите в систему, чтобы увидеть информацию о вашей реферальной программе.</p>
        </div>
      </div>
    `;
    
    // Добавляем стили для виджета
    const style = document.createElement('style');
    style.textContent = `
      .referral-widget {
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 300px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9998;
        overflow: hidden;
        font-family: Arial, sans-serif;
      }
      
      .referral-widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background-color: #4CAF50;
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
        border-radius: 4px;
        cursor: pointer;
      }
      
      .referral-link {
        word-break: break-all;
        color: #2196F3;
      }
      
      .referral-widget.collapsed .referral-widget-content {
        display: none;
      }
      
      .referral-widget.collapsed .referral-widget-toggle {
        transform: rotate(180deg);
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
      localStorage.setItem('referralCode', referralCode);
      
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
  
  // Немедленная проверка перенаправления
  (function() {
    const referralCode = getUrlParameter('ref');
    const redirect = getUrlParameter('redirect');
    
    console.log('Немедленная проверка перенаправления. Реферальный код:', referralCode, 'Параметр redirect:', redirect);
    
    // Если есть реферальный код и параметр redirect
    if (referralCode && (redirect === 'signup' || redirect === 'register' || redirect === 'registration' || redirect === '1')) {
      console.log('Условия для немедленного перенаправления выполнены');
      
      // Сохраняем реферальный код перед перенаправлением
      localStorage.setItem('referralCode', referralCode);
      
      // Выполняем перенаправление
      window.location.href = '/members/signup';
    }
  })();

  // Запускаем инициализацию при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Повторно запускаем перехватчики форм через интервалы
  setInterval(setupFormInterceptors, 3000);
})();