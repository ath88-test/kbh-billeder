let closeButton = document.querySelectorAll('.site-wide-message__close');
let siteMessageBody = document.querySelector('.site-wide-messages');

// If user has not closed the messages earlier, show it.
// By doing it this way we prevent the message box turning up and then dissapearing.
if(window.sessionStorage) {
  let hideMessages = sessionStorage.getItem('hideMessages');
  if(!hideMessages && siteMessageBody) {
    siteMessageBody.classList.remove('hide');
  }
}

// Allow user to close message box.
if(closeButton) {
  closeButton.forEach(button => {
    button.addEventListener('click', event => {
      siteMessageBody.classList.add('hide');
      if(window.sessionStorage) {
        sessionStorage.setItem('hideMessages', true);
      }
    })
  })
}
