// Actions
const SHOW_EDITING_SELECTOR = '[data-action="feedback:start"]';
const HIDE_EDITING_SELECTOR = '[data-action="feedback:stop"]';
const SEND_FORM_SELECTOR = '[data-action="feedback:send"]';

const FORM_SELECTOR = '.feedback__form';
const FORM_ERROR_MESSAGE = '.feedback__error-message';
const COUNTER_SELECTOR = '.feedback__counter';
const EDITING_CONTAINER_SELECTOR = '.feedback__container';

const BASE_CLASS = 'feedback';
const IS_EDITING_CLASS = 'feedback--editing';
const ERROR_CLASS = 'feedback--error';
const SUCCESS_CLASS = 'feedback--success';

$(function() {
  class FeedbackController {
    constructor($feedback) {
      this.$feedback = $feedback;
      this.$container = $feedback.find(EDITING_CONTAINER_SELECTOR);
      this.$form = $feedback.find(FORM_SELECTOR);
      this.$errorMessage = $feedback.find(FORM_ERROR_MESSAGE);
      this.$counter = $feedback.find(COUNTER_SELECTOR);
      this.$sendButton = $feedback.find(SEND_FORM_SELECTOR);

      this.registerListeners();
    }

    reset() {
      this.$feedback.attr('class', BASE_CLASS);
    }

    toggleEditing(editing) {
      if(editing) {
        this.$feedback.removeClass(ERROR_CLASS + ' ' + SUCCESS_CLASS)
      }
      this.$feedback.toggleClass(IS_EDITING_CLASS, editing);
    }

    handleError(errorMessage) {
      this.$errorMessage.text(errorMessage);
      this.$feedback.addClass(ERROR_CLASS);
    }

    handleSuccess() {
      this.$feedback.addClass(SUCCESS_CLASS);
      this.toggleEditing(false);
    }

    send() {
      const url = location.pathname + '/feedback';
      const message = this.$form.val();
      if(message) {
        this.$sendButton.attr('disabled', true);
        $.post(url, {message}, () => {}, 'json')
        .done(() => this.handleSuccess())
        .fail(() => this.handleError('Der skete en fejl. Prøv venligst igen senere.'))
        .always(() => this.$sendButton.attr('disabled', false))
      }
      else {
        this.handleError('Du kan ikke sende en tom besked.');
      }
    }

    registerListeners() {
      this.$feedback.on('click', SHOW_EDITING_SELECTOR, (event) => {
        this.toggleEditing(true);
      })
      this.$feedback.on('click', HIDE_EDITING_SELECTOR, (event) => {
        this.toggleEditing(false);
      })
      this.$feedback.on('click', SEND_FORM_SELECTOR, (event) => {
        this.send();
      })
      this.$feedback.on('keyup', FORM_SELECTOR, (event) => {
        this.$counter.text(event.target.value.length);
      })
      this.$feedback.on('keydown', FORM_SELECTOR, (event) => {
        // Stop the navigator script from redirecting us to another page.
        event.stopPropagation();
        // We're listening to key down as well, since it updates if a user
        // holds a key for a duration.
        this.$counter.text(event.target.value.length);
      })

    }
  }

  $(() => {
    $('.feedback').each((index, feedback) => {
      const $feedback = $(feedback);
      // Initialize a controller
      const controller = new FeedbackController($feedback);
    });
  });
})
