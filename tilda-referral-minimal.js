// Минимальная версия скрипта реферальной системы для Tilda
(function() {
  console.log('Минимальная версия скрипта реферальной системы активирована');
  
  // URL нашего сервера
  const SERVER_URL = 'https://supabase-auth-production-4267.up.railway.app';
  
  // Функция для получения параметров из URL без использования localStorage
  function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }
  
  // Функция для создания и добавления скрытого поля в форму
  function addHiddenField(form, name, value) {
    // Проверяем, существует ли уже поле
    let field = form.querySelector(`input[name="${name}"]`);
    
    // Если поля нет, создаем его
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.appendChild(field);
    }
    
    // Устанавливаем значение
    field.value = value;
  }
  
  // Функция для перехвата форм и добавления реферального кода
  function setupForms() {
    // Получаем реферальный код из URL
    const referralCode = getUrlParameter('ref');
    
    if (!referralCode) {
      return; // Если нет реферального кода, ничего не делаем
    }
    
    // Находим все формы на странице
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      // Проверяем, не обработана ли уже форма
      if (form.dataset.refProcessed) {
        return;
      }
      
      // Помечаем форму как обработанную
      form.dataset.refProcessed = 'true';
      
      // Добавляем скрытое поле с реферальным кодом
      addHiddenField(form, 'referralCode', referralCode);
      
      console.log('Добавлен реферальный код в форму:', referralCode);
    });
  }
  
  // Функция для отображения реферальной информации
  function displayReferralInfo() {
    // Получаем email из URL или из cookie
    const email = getUrlParameter('email') || getCookie('userEmail');
    
    if (!email) {
      return; // Если нет email, ничего не делаем
    }
    
    // Отправляем запрос на сервер для получения реферальной информации
    fetch(`${SERVER_URL}/referral-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error('Ошибка при получении реферальной информации:', data.error);
        return;
      }
      
      // Обновляем элементы с классами для отображения реферальной информации
      updateElements('.referral-code', data.user.referral_code || '');
      updateElements('.referral-balance', (data.user.balance_kgs || 0).toFixed(2) + ' KGS');
      updateElements('.referral-total-earned', (data.user.total_earned || 0).toFixed(2) + ' KGS');
      updateElements('.referral-level1-count', data.referral_stats.level_1_count || 0);
      updateElements('.referral-level2-count', data.referral_stats.level_2_count || 0);
      updateElements('.referral-level3-count', data.referral_stats.level_3_count || 0);
      updateElements('.referral-total-count', data.referral_stats.total_referrals || 0);
      
      // Обновляем реферальную ссылку
      const baseUrl = window.location.origin;
      const referralLink = `${baseUrl}?ref=${data.user.referral_code}`;
      
      updateElements('.referral-link', referralLink, 'href');
      updateElements('.referral-link', referralLink);
      
      // Показываем блоки с реферальной информацией
      document.querySelectorAll('.referral-info-block').forEach(el => {
        el.style.display = 'block';
      });
      
      // Добавляем обработчики для кнопок копирования
      document.querySelectorAll('.copy-referral-link').forEach(button => {
        // Проверяем, не добавлен ли уже обработчик
        if (button.dataset.copyHandlerAdded) {
          return;
        }
        
        // Помечаем кнопку
        button.dataset.copyHandlerAdded = 'true';
        
        // Добавляем обработчик
        button.addEventListener('click', function() {
          // Создаем временный элемент для копирования
          const tempInput = document.createElement('input');
          tempInput.value = referralLink;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          
          // Показываем уведомление
          alert('Реферальная ссылка скопирована!');
        });
      });
    })
    .catch(error => {
      console.error('Ошибка при запросе реферальной информации:', error);
    });
  }
  
  // Вспомогательная функция для обновления элементов с определенным классом
  function updateElements(selector, value, attribute) {
    document.querySelectorAll(selector).forEach(el => {
      if (attribute) {
        el.setAttribute(attribute, value);
      } else {
        el.textContent = value;
      }
    });
  }
  
  // Вспомогательная функция для получения cookie
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
  
  // Инициализация
  function init() {
    // Настраиваем формы
    setupForms();
    
    // Отображаем реферальную информацию
    displayReferralInfo();
    
    // Повторно запускаем настройку форм через интервалы
    // (для динамически добавляемых форм)
    setInterval(setupForms, 2000);
  }
  
  // Запускаем инициализацию при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();