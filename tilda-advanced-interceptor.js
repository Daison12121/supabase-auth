// Расширенный перехватчик данных для Tilda
(function() {
  console.log('Расширенный перехватчик данных для Tilda активирован');
  
  // Функция для отправки email на сервер
  function sendEmailToServer(email, source, originalData) {
    console.log('Отправка email на сервер:', email, 'Источник:', source);
    
    fetch('https://supabase-auth-production-4267.up.railway.app/get-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: email,
        source: source,
        originalData: originalData
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Ответ от сервера:', data);
      
      // Если пользователь найден, выполняем действия
      if (!data.error) {
        showNotification('Пользователь найден: ' + email);
        localStorage.setItem('userVerified', 'true');
        localStorage.setItem('userEmail', email);
      }
    })
    .catch(error => {
      console.error('Ошибка при отправке данных на сервер:', error);
    });
  }
  
  // Функция для отображения уведомления
  function showNotification(message) {
    let notification = document.getElementById('email-verification-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'email-verification-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      notification.style.padding = '15px';
      notification.style.borderRadius = '5px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      notification.style.zIndex = '9999';
      notification.style.display = 'none';
      document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }
  
  // Метод 1: Перехват localStorage
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    // Вызываем оригинальный метод
    originalSetItem.apply(this, arguments);
    
    // Проверяем, содержит ли ключ или значение упоминание пользователя или email
    const keyLower = key.toLowerCase();
    const valueLower = String(value).toLowerCase();
    
    if ((keyLower.includes('user') || keyLower.includes('email') || keyLower.includes('auth')) && 
        valueLower.includes('@')) {
      console.log('Перехвачена запись в localStorage:', key, value);
      
      // Извлекаем email из значения
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
      const matches = String(value).match(emailRegex);
      
      if (matches && matches.length > 0) {
        const email = matches[0];
        sendEmailToServer(email, 'localStorage', { key, value });
      }
    }
  };
  
  // Метод 2: Перехват cookie
  const originalDocumentCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  
  Object.defineProperty(document, 'cookie', {
    get: function() {
      return originalDocumentCookie.get.call(this);
    },
    set: function(value) {
      // Проверяем, содержит ли cookie email
      if (value.includes('@')) {
        console.log('Перехвачена запись в cookie:', value);
        
        // Извлекаем email из значения
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const matches = value.match(emailRegex);
        
        if (matches && matches.length > 0) {
          const email = matches[0];
          sendEmailToServer(email, 'cookie', { cookie: value });
        }
      }
      
      return originalDocumentCookie.set.call(this, value);
    },
    configurable: true
  });
  
  // Метод 3: Перехват форм
  function setupFormInterceptors() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(function(form, index) {
      // Проверяем, не был ли уже установлен перехватчик
      if (form.dataset.intercepted) {
        return;
      }
      
      // Помечаем форму как перехваченную
      form.dataset.intercepted = 'true';
      
      console.log('Установка перехватчика на форму #' + index, form);
      
      // Добавляем обработчик события отправки формы
      form.addEventListener('submit', function(e) {
        // Ищем поле email в форме
        const emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"], input[placeholder*="email"]');
        
        if (emailField && emailField.value) {
          console.log('Перехвачена отправка формы с email:', emailField.value);
          sendEmailToServer(emailField.value, 'form', { formId: form.id, formAction: form.action });
        }
      });
    });
  }
  
  // Метод 4: Перехват Tilda API
  function interceptTildaAPI() {
    // Перехватываем объект window.tildaForm если он существует
    if (window.tildaForm) {
      const originalSend = window.tildaForm.send;
      
      window.tildaForm.send = function(form, btnSubmit, formType) {
        console.log('Перехвачен вызов tildaForm.send', form);
        
        // Ищем поле email в форме
        const emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"], input[placeholder*="email"]');
        
        if (emailField && emailField.value) {
          console.log('Найден email в форме Tilda:', emailField.value);
          sendEmailToServer(emailField.value, 'tildaForm', { formId: form.id, formType: formType });
        }
        
        // Вызываем оригинальный метод
        return originalSend.apply(this, arguments);
      };
    }
    
    // Перехватываем объект window.tildaForm.payment если он существует
    if (window.tildaForm && window.tildaForm.payment) {
      const originalPayment = window.tildaForm.payment;
      
      window.tildaForm.payment = function(form) {
        console.log('Перехвачен вызов tildaForm.payment', form);
        
        // Ищем поле email в форме
        const emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"], input[placeholder*="email"]');
        
        if (emailField && emailField.value) {
          console.log('Найден email в форме оплаты Tilda:', emailField.value);
          sendEmailToServer(emailField.value, 'tildaPayment', { formId: form.id });
        }
        
        // Вызываем оригинальный метод
        return originalPayment.apply(this, arguments);
      };
    }
  }
  
  // Метод 5: Перехват Tilda Members API
  function interceptTildaMembers() {
    // Проверяем наличие объекта window.tildaMembers
    if (window.tildaMembers) {
      // Перехватываем метод авторизации
      if (window.tildaMembers.authorize) {
        const originalAuthorize = window.tildaMembers.authorize;
        
        window.tildaMembers.authorize = function(email, password, callback) {
          console.log('Перехвачен вызов tildaMembers.authorize с email:', email);
          
          if (email) {
            sendEmailToServer(email, 'tildaMembers', { action: 'authorize' });
          }
          
          // Вызываем оригинальный метод
          return originalAuthorize.apply(this, arguments);
        };
      }
      
      // Перехватываем метод регистрации
      if (window.tildaMembers.registration) {
        const originalRegistration = window.tildaMembers.registration;
        
        window.tildaMembers.registration = function(email, password, callback) {
          console.log('Перехвачен вызов tildaMembers.registration с email:', email);
          
          if (email) {
            sendEmailToServer(email, 'tildaMembers', { action: 'registration' });
          }
          
          // Вызываем оригинальный метод
          return originalRegistration.apply(this, arguments);
        };
      }
    }
  }
  
  // Метод 6: Прямой поиск email на странице
  function scanPageForEmails() {
    // Ищем все элементы, которые могут содержать email
    const elements = document.querySelectorAll('div, span, p, a, h1, h2, h3, h4, h5, h6');
    
    elements.forEach(function(element) {
      const text = element.textContent || '';
      
      // Проверяем, содержит ли текст email
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
      const matches = text.match(emailRegex);
      
      if (matches && matches.length > 0) {
        console.log('Найден email в тексте страницы:', matches[0]);
        sendEmailToServer(matches[0], 'pageText', { elementTag: element.tagName, elementText: text });
      }
    });
  }
  
  // Метод 7: Перехват window.t_onReady
  const originalTOnReady = window.t_onReady;
  
  window.t_onReady = function(callback) {
    // Вызываем оригинальный метод
    if (typeof originalTOnReady === 'function') {
      originalTOnReady(function() {
        // Вызываем оригинальный callback
        if (typeof callback === 'function') {
          callback();
        }
        
        // Запускаем наши перехватчики после загрузки Tilda
        setTimeout(function() {
          setupFormInterceptors();
          interceptTildaAPI();
          interceptTildaMembers();
          scanPageForEmails();
        }, 1000);
      });
    } else {
      // Если оригинального метода нет, просто вызываем callback
      if (typeof callback === 'function') {
        callback();
      }
      
      // Запускаем наши перехватчики после загрузки Tilda
      setTimeout(function() {
        setupFormInterceptors();
        interceptTildaAPI();
        interceptTildaMembers();
        scanPageForEmails();
      }, 1000);
    }
  };
  
  // Запускаем перехватчики сразу
  setTimeout(function() {
    setupFormInterceptors();
    interceptTildaAPI();
    interceptTildaMembers();
    scanPageForEmails();
    
    // Повторно запускаем перехватчики через интервалы, чтобы поймать динамически добавленные элементы
    setInterval(setupFormInterceptors, 3000);
    setInterval(scanPageForEmails, 5000);
  }, 1000);
  
  // Также запускаем при изменении DOM
  const observer = new MutationObserver(function(mutations) {
    setupFormInterceptors();
  });
  
  // Наблюдаем за изменениями в DOM
  observer.observe(document.body, { childList: true, subtree: true });
})();