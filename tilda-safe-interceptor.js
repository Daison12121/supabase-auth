// Безопасный перехватчик данных для Tilda с защитой от рекурсии
(function() {
  console.log('Безопасный перехватчик данных для Tilda активирован');
  
  // URL нашего сервера для проверки, чтобы избежать рекурсивных запросов
  const OUR_SERVER_URL = 'https://supabase-auth-production-4267.up.railway.app/get-user';
  
  // Кэш для хранения уже проверенных email
  const emailCache = {};
  
  // Флаг для отслеживания, выполняется ли в данный момент запрос
  let isRequestInProgress = false;
  
  // Время последнего запроса
  let lastRequestTime = 0;
  
  // Минимальный интервал между запросами (в миллисекундах)
  const MIN_REQUEST_INTERVAL = 2000; // 2 секунды
  
  // Флаг для предотвращения рекурсивных запросов
  let isOurRequest = false;
  
  // Функция для отправки email на сервер
  function sendEmailToServer(email, source, originalData, isHighPriority = false) {
    // Проверяем, был ли этот email уже проверен
    if (emailCache[email] && !isHighPriority) {
      console.log('Email уже проверен ранее:', email, 'Результат:', emailCache[email]);
      
      // Если пользователь был найден ранее, выполняем действия
      if (emailCache[email].found) {
        showNotification('Пользователь найден: ' + email);
        localStorage.setItem('userVerified', 'true');
        localStorage.setItem('userEmail', email);
      }
      
      return;
    }
    
    // Проверяем, не выполняется ли уже запрос и прошло ли достаточно времени с последнего запроса
    const currentTime = Date.now();
    if (!isHighPriority && (isRequestInProgress || (currentTime - lastRequestTime < MIN_REQUEST_INTERVAL))) {
      console.log('Запрос отложен, слишком частые запросы или запрос уже выполняется:', email);
      return;
    }
    
    console.log('Отправка email на сервер:', email, 'Источник:', source);
    
    // Устанавливаем флаг, что запрос выполняется
    isRequestInProgress = true;
    lastRequestTime = currentTime;
    
    // Устанавливаем флаг, что это наш запрос, чтобы избежать рекурсии
    isOurRequest = true;
    
    fetch(OUR_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Interceptor-Request': 'true' // Специальный заголовок для идентификации наших запросов
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
      
      // Сохраняем результат в кэше
      emailCache[email] = {
        found: !data.error,
        data: data
      };
      
      // Если пользователь найден, выполняем действия
      if (!data.error) {
        showNotification('Пользователь найден: ' + email);
        localStorage.setItem('userVerified', 'true');
        localStorage.setItem('userEmail', email);
      } else if (isHighPriority) {
        // Показываем уведомление об ошибке только для высокоприоритетных запросов (например, при отправке формы)
        showNotification('Пользователь не найден: ' + email, 'error');
      }
    })
    .catch(error => {
      console.error('Ошибка при отправке данных на сервер:', error);
      
      // Сохраняем ошибку в кэше
      emailCache[email] = {
        found: false,
        error: error
      };
      
      if (isHighPriority) {
        showNotification('Ошибка при проверке пользователя', 'error');
      }
    })
    .finally(() => {
      // Сбрасываем флаги запроса
      isRequestInProgress = false;
      isOurRequest = false;
    });
  }
  
  // Функция для отображения уведомления
  function showNotification(message, type = 'success') {
    let notification = document.getElementById('email-verification-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'email-verification-notification';
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
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }
  
  // Метод 1: Перехват форм (высокий приоритет)
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
          sendEmailToServer(emailField.value, 'form', { formId: form.id, formAction: form.action }, true);
        }
      });
    });
  }
  
  // Метод 2: Перехват Tilda API (высокий приоритет)
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
          sendEmailToServer(emailField.value, 'tildaForm', { formId: form.id, formType: formType }, true);
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
          sendEmailToServer(emailField.value, 'tildaPayment', { formId: form.id }, true);
        }
        
        // Вызываем оригинальный метод
        return originalPayment.apply(this, arguments);
      };
    }
  }
  
  // Метод 3: Перехват Tilda Members API (высокий приоритет)
  function interceptTildaMembers() {
    // Проверяем наличие объекта window.tildaMembers
    if (window.tildaMembers) {
      // Перехватываем метод авторизации
      if (window.tildaMembers.authorize) {
        const originalAuthorize = window.tildaMembers.authorize;
        
        window.tildaMembers.authorize = function(email, password, callback) {
          console.log('Перехвачен вызов tildaMembers.authorize с email:', email);
          
          if (email) {
            sendEmailToServer(email, 'tildaMembers', { action: 'authorize' }, true);
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
            sendEmailToServer(email, 'tildaMembers', { action: 'registration' }, true);
          }
          
          // Вызываем оригинальный метод
          return originalRegistration.apply(this, arguments);
        };
      }
    }
  }
  
  // Метод 4: Перехват запросов к API Tilda Members (высокий приоритет)
  function interceptTildaMembersAPI() {
    // Перехватываем XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function() {
      this._url = arguments[1];
      this._method = arguments[0];
      
      // Проверяем, является ли запрос запросом к API Tilda Members
      if (this._url && typeof this._url === 'string' && 
          (this._url.includes('members') || this._url.includes('auth') || this._url.includes('login')) &&
          !this._url.includes(OUR_SERVER_URL)) { // Исключаем наши собственные запросы
        console.log('Перехвачен XHR запрос к API Tilda Members:', this._method, this._url);
        this._isTildaMembersRequest = true;
      }
      
      return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
      // Если это запрос к API Tilda Members и не наш собственный запрос, проверяем данные
      if (this._isTildaMembersRequest && !isOurRequest && data) {
        console.log('Отправляемые данные в API Tilda Members:', data);
        
        try {
          // Пытаемся извлечь email из данных
          let email = null;
          
          // Если данные в формате строки, пытаемся распарсить их
          if (typeof data === 'string') {
            // Проверяем, содержит ли строка email
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
            const matches = data.match(emailRegex);
            
            if (matches && matches.length > 0) {
              email = matches[0];
              console.log('Извлечен email из данных запроса:', email);
              sendEmailToServer(email, 'tildaMembersXHR', { url: this._url, method: this._method }, true);
            }
            
            // Также пытаемся распарсить JSON
            try {
              const jsonData = JSON.parse(data);
              
              if (jsonData.email) {
                email = jsonData.email;
                console.log('Извлечен email из JSON данных запроса:', email);
                sendEmailToServer(email, 'tildaMembersXHR', { url: this._url, method: this._method }, true);
              } else if (jsonData.data && jsonData.data.email) {
                email = jsonData.data.email;
                console.log('Извлечен email из JSON данных запроса (data.email):', email);
                sendEmailToServer(email, 'tildaMembersXHR', { url: this._url, method: this._method }, true);
              }
            } catch (e) {
              // Игнорируем ошибки при парсинге JSON
            }
          }
        } catch (e) {
          console.error('Ошибка при обработке данных запроса:', e);
        }
      }
      
      // Перехватываем ответ
      if (this._isTildaMembersRequest && !isOurRequest) {
        this.addEventListener('load', function() {
          try {
            // Пытаемся распарсить ответ как JSON
            const responseData = JSON.parse(this.responseText);
            
            // Ищем email в ответе
            let email = null;
            
            if (responseData.email) {
              email = responseData.email;
            } else if (responseData.data && responseData.data.email) {
              email = responseData.data.email;
            } else if (responseData.fields && responseData.fields.Email) {
              email = responseData.fields.Email;
            } else if (responseData.fields && responseData.fields.email) {
              email = responseData.fields.email;
            } else {
              // Если не нашли email в известных форматах, ищем в строке
              const responseStr = JSON.stringify(responseData);
              const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
              const matches = responseStr.match(emailRegex);
              
              if (matches && matches.length > 0) {
                email = matches[0];
              }
            }
            
            if (email) {
              console.log('Извлечен email из ответа API Tilda Members:', email);
              sendEmailToServer(email, 'tildaMembersXHRResponse', { url: this._url, method: this._method }, true);
            }
          } catch (e) {
            // Игнорируем ошибки при парсинге JSON
          }
        });
      }
      
      return originalXHRSend.apply(this, arguments);
    };
    
    // Перехватываем fetch запросы
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options) {
      // Проверяем, является ли запрос запросом к API Tilda Members и не наш собственный запрос
      if (!isOurRequest && url && typeof url === 'string' && 
          (url.includes('members') || url.includes('auth') || url.includes('login')) &&
          !url.includes(OUR_SERVER_URL)) { // Исключаем наши собственные запросы
        console.log('Перехвачен fetch запрос к API Tilda Members:', url, options);
        
        // Проверяем данные запроса
        if (options && options.body) {
          try {
            // Пытаемся извлечь email из данных
            let email = null;
            
            // Если данные в формате строки, пытаемся распарсить их
            if (typeof options.body === 'string') {
              // Проверяем, содержит ли строка email
              const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
              const matches = options.body.match(emailRegex);
              
              if (matches && matches.length > 0) {
                email = matches[0];
                console.log('Извлечен email из данных fetch запроса:', email);
                sendEmailToServer(email, 'tildaMembersFetch', { url: url, method: options ? options.method : 'GET' }, true);
              }
              
              // Также пытаемся распарсить JSON
              try {
                const jsonData = JSON.parse(options.body);
                
                if (jsonData.email) {
                  email = jsonData.email;
                  console.log('Извлечен email из JSON данных fetch запроса:', email);
                  sendEmailToServer(email, 'tildaMembersFetch', { url: url, method: options ? options.method : 'GET' }, true);
                } else if (jsonData.data && jsonData.data.email) {
                  email = jsonData.data.email;
                  console.log('Извлечен email из JSON данных fetch запроса (data.email):', email);
                  sendEmailToServer(email, 'tildaMembersFetch', { url: url, method: options ? options.method : 'GET' }, true);
                }
              } catch (e) {
                // Игнорируем ошибки при парсинге JSON
              }
            }
          } catch (e) {
            console.error('Ошибка при обработке данных fetch запроса:', e);
          }
        }
      }
      
      // Если это наш запрос к нашему серверу, добавляем специальный заголовок
      if (url && typeof url === 'string' && url.includes(OUR_SERVER_URL)) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers['X-Interceptor-Request'] = 'true';
      }
      
      return originalFetch.apply(this, arguments)
        .then(response => {
          // Проверяем, является ли ответ от API Tilda Members и не наш собственный запрос
          if (!isOurRequest && url && typeof url === 'string' && 
              (url.includes('members') || url.includes('auth') || url.includes('login')) &&
              !url.includes(OUR_SERVER_URL)) {
            // Клонируем ответ, чтобы не нарушить его обработку
            const clone = response.clone();
            
            // Пытаемся прочитать и проверить данные ответа
            clone.json().then(data => {
              // Ищем email в ответе
              let email = null;
              
              if (data.email) {
                email = data.email;
              } else if (data.data && data.data.email) {
                email = data.data.email;
              } else if (data.fields && data.fields.Email) {
                email = data.fields.Email;
              } else if (data.fields && data.fields.email) {
                email = data.fields.email;
              } else {
                // Если не нашли email в известных форматах, ищем в строке
                const dataStr = JSON.stringify(data);
                const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
                const matches = dataStr.match(emailRegex);
                
                if (matches && matches.length > 0) {
                  email = matches[0];
                }
              }
              
              if (email) {
                console.log('Извлечен email из ответа API Tilda Members (fetch):', email);
                sendEmailToServer(email, 'tildaMembersFetchResponse', { url: url, method: options ? options.method : 'GET' }, true);
              }
            }).catch(() => {
              // Игнорируем ошибки при парсинге ответа
            });
          }
          
          return response;
        });
    };
  }
  
  // Метод 5: Перехват localStorage (низкий приоритет)
  function interceptLocalStorage() {
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
          sendEmailToServer(email, 'localStorage', { key, value }, false);
        }
      }
    };
  }
  
  // Метод 6: Перехват cookie (низкий приоритет)
  function interceptCookie() {
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
            sendEmailToServer(email, 'cookie', { cookie: value }, false);
          }
        }
        
        return originalDocumentCookie.set.call(this, value);
      },
      configurable: true
    });
  }
  
  // Метод 7: Перехват window.t_onReady
  function interceptTOnReady() {
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
            interceptTildaMembersAPI();
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
          interceptTildaMembersAPI();
        }, 1000);
      }
    };
  }
  
  // Запускаем перехватчики
  function initInterceptors() {
    // Высокоприоритетные перехватчики (активные действия пользователя)
    setupFormInterceptors();
    interceptTildaAPI();
    interceptTildaMembers();
    interceptTildaMembersAPI();
    
    // Низкоприоритетные перехватчики (пассивные данные)
    interceptLocalStorage();
    interceptCookie();
    interceptTOnReady();
    
    // Повторно запускаем перехватчики форм через интервалы, чтобы поймать динамически добавленные формы
    setInterval(setupFormInterceptors, 3000);
  }
  
  // Запускаем перехватчики при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInterceptors);
  } else {
    initInterceptors();
  }
  
  // Также запускаем при изменении DOM
  const observer = new MutationObserver(function(mutations) {
    setupFormInterceptors();
  });
  
  // Наблюдаем за изменениями в DOM
  observer.observe(document.body, { childList: true, subtree: true });
})();