
function logErrorReason(reason) {
    // log the error reason but keep the rejection
    console.log('Response error reason:', reason)
    return Promise.reject(reason)
  }
  
  // This is our special type of Error that represents
  // when a request got a 401 Unauthorized response
  export function UnauthorizedError(message) {
    this.name = 'UnauthorizedError'
    this.message = message
  }
  UnauthorizedError.prototype = new Error()
  
  function checkStatus(response) {
    if (response.status >= 200 && response.status < 300) {
        return response
    } else if(response.status === 401) {
        var unauthorizedError = new UnauthorizedError(response.statusText)
        unauthorizedError.response = response;
        return Promise.reject(unauthorizedError)
    } else {
        var error = new Error(response.statusText)
        error.response = response
        return Promise.reject(error)
    }
  }
  
  export async function fetchData(path, options={}) {
    return await fetch(`${path}`, {
        mode: 'cors',
        credentials: 'include',
        ...options,
        headers: {
            Accept: 'application/json',
            ...options.headers,
        },
    })
    .then(checkStatus)
    .catch(logErrorReason);
  }
  
  export async function postData(path, data, options={}) {
      return await fetch(`${path}`, {
          mode: 'cors',
          credentials: 'include',
          ...options,
          headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...options.headers,
          },
          method: 'POST',
          body: JSON.stringify(data)
      })
      .then(checkStatus)
      .catch(logErrorReason);
  }
  
  export async function putData(path, data, options={}) {
      return await fetch(`${path}`, {
          mode: 'cors',
          credentials: 'include',
          ...options,
          headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...options.headers,
          },
          method: 'PUT',
          body: JSON.stringify(data)
      })
      .then(checkStatus)
      .catch(logErrorReason);
  }
  