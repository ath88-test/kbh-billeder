var REDIRECTION_URL = 'http://www.kbharkiv.dk/';
var LOCALSTORAGE_FIELD = 'password';

function isValidPassword() {
  return localStorage.getItem(LOCALSTORAGE_FIELD) === 'edagleda';
}

if (typeof(Storage) !== 'undefined') {
  var msg = ['Du skal kende et kodeord for at besøge siden'];

  if(!isValidPassword()) {
    var password = prompt(msg.join(' '));
    if (password) {
      localStorage.setItem(LOCALSTORAGE_FIELD, password.split('').reverse().join(''));
    }
    if(!isValidPassword()) {
      location.href="http://www.kbharkiv.dk/";
    }
  }
} else {
  var msg = ['Sitet er desværre ikke lanceret endnu - for at kunne se det skal',
             'du benytte en moderne browser.'];
  alert(msg.join(' '));
  location.href = REDIRECTION_URL;
}
