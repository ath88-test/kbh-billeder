/**
 * This module handles all clientside searching
 */

const request = require('request');
const config = require('../../../../shared/config');
const _ = require('lodash');

const SELECTOR_USER_CONTRIBUTIONS_SECTIONS = '#user-contributions .user-contributions__section[data-section]';
const SELECTOR_USER_CONTRIBUTIONS_TABS = '#user-contributions .user-contributions__header-tab[data-section]';
const SELECTOR_DEFAULT_USER_CONTRIBUTIONS_TAB = '#user-contributions .user-contributions__header-tab[data-section=tag]';

/**
 * Sets up a controller that can retrive user contributions and add them to a
 * profile page.
 *
 * @constructor
 */
function UserContributionsLoader({$sectionElement, fetchEndpoint}) {
  // Keep track of which page we'll fetch next.
  // Notice: The endpoint is 1-indexed, and the page-size is determined on the
  // backend.
  let nextPage = 1;
  let firstFetchAttempted = false;
  let hasMore = true;

  const $loadMoreButton = $sectionElement.find('.load-more-btn').first();

  let lastSection = undefined;
  const templates = {
    contributionSection: require('@views/includes/profile/user-contributions-section')
  };

  function getContributionDate (timeString) {
    const date = new Date(timeString);
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDay();
  }

  const _sectionBuilder = (sections, item) => {
    item.contribution_date = getContributionDate(item.contribution_time);

    const currentSectionIndex = sections.length - 1;
    // Append to current section if it as the same date as the current item.
    if (sections.length > 0 && sections[currentSectionIndex].date === item.contribution_date) {
      // But only if the asset is not already in the section - this should only
      // happen if we're appending to an old section after a new fetch so we
      // explicitly check the last element.
      const length = sections[currentSectionIndex].items.length;
      if (length === 0 || sections[currentSectionIndex].items[length-1].id !== item.id) {
        sections[currentSectionIndex].items.push(item);
      }
    } else {
      // Create a new section with the current item in it.
      sections.push(
        {
          time: item.contribution_time,
          date: item.contribution_date,
          formatted_date: item.formatted_date,
          id: item.contribution_date,
          items: [item]
        }
      );

    }
    return sections;
  };

  const _enableEndlessScrolling = () => {
    $loadMoreButton.addClass('hidden');

    // Kick off the first fetch.
    doFetch(function(newItems) {
      // Only in the first fetch do we focus next element;
      // for all the future loads we rely on endless scrolling
      // letting us continue tabbing through elements.
      if(newItems.length) {
        newItems[0].focus();
      }
    });

    $(window).on('scroll', function(e) {
      if (!hasMore) {
        return;
      }

      var $lastItem = $('.user-contributions__section:last-child .user-contributions__item:last-child', $sectionElement);
      if (!$lastItem.length > 0) {
        return;
      }

      var lastItemOffset = $lastItem.offset();
      var scrollTop = $(window).scrollTop();
      var scrollBottom = scrollTop + $(window).height();
      if(scrollBottom > lastItemOffset.top && !$sectionElement.attr('aria-busy') && hasMore) {
        // TODO - after we've fetched we might still end up with few enough
        // results to confuse the user (we de-duplicate results).
        // We should either fetch more results, or have the api-endpoint changed
        // so that we dont have to do the de-duplication.
        doFetch();
      }

    });
  };

  // Setup listeners
  $loadMoreButton.click(_enableEndlessScrolling);

  // Controller handles.
  /**
   * Fetch data from the backend.
   */
  const _responseCallback = (done) => (error, response, body) => {
    if (error) {
      console.warn('Error while fetching contributions');
      console.warn(error);
      $sectionElement.removeAttr('aria-busy');
      return;
    }

    const jsonData = JSON.parse(body);
    // Process data if it is available.
    if (jsonData.length > 0) {
      // The API will give us repeat results for assets if the user has made
      // multiple contributions to it. We only want to display a single result pr
      // asset so we reduce it down to a uniqe list.
      load(_.uniqBy(jsonData, 'id'), done);
    } else if (!firstFetchAttempted) {
      // We where never able to fetch any data for this section, add a class
      // saying so.
      $sectionElement.addClass('is-empty');
    }

    // If it seems like we have more contributions, get ready for the next
    // page.
    if (jsonData.length >= config.search.contributionsPageSize) {
      nextPage++;
      hasMore = true;
    } else {
      hasMore = false;
      // Hide the load more button if its where visible.
      $loadMoreButton.addClass('hidden');
    }

    // We've successfully initialized.
    if (!firstFetchAttempted) {
      firstFetchAttempted = true;
    }

    $sectionElement.removeAttr('aria-busy');
  };

  const doFetch = (done) => {
    if (!hasMore) {
      return;
    }

    $sectionElement.attr('aria-busy', true);
    request({'url': `${fetchEndpoint}/${nextPage}`}, _responseCallback(done));
  };

  // Function for loading contributions into an element.
  const load = (items, done) => {
    // See if we should start off with the last section.
    let initialList = [];
    if (lastSection && lastSection.date === getContributionDate(items[0].contribution_time)) {
      initialList = [lastSection];
      // Remove last section.
      $sectionElement.find('#' + lastSection.id).remove();
    }

    // Convert list of items to list of sections with items
    const sections = items.reduce(_sectionBuilder, initialList);

    // TODO - at this point we could start storing results into the browsers
    // history in order to be able to return to the same resultset.
    // Render each section and add it to the region.
    const $contributionsSection = $sectionElement
      .children('.user-contributions__section-contributions')
      .first();

    sections.forEach((section) => {
      $contributionsSection.append(templates.contributionSection({section}));
      lastSection = section;
    });

    if(done) {
      done(items.map((item) => $contributionsSection.find(`[data-id='${item.id}']`)));
    }
  };

  // Return a handler object the caller can use to load more elments.
  return {
    doFetch,
    // Returns true if we either have not attempted to fetch any data, or
    // we've yet to hit the last page.
    hasMore: () => { return !firstFetchAttempted || hasMore; },
    firstFetchAttempted: () =>  {return firstFetchAttempted; },

  };
}

function initialize($) {
  const _handleTabClick = (event) => {
    const $tabElement = $(event.currentTarget);
    const sectionNameSelector = '.user-contributions__section-' + $tabElement.data('section');
    const sectionController = $(sectionNameSelector).data('controller');

    // Reset all sections and tabs.
    $(SELECTOR_USER_CONTRIBUTIONS_SECTIONS).removeClass('is-active');
    $(SELECTOR_USER_CONTRIBUTIONS_TABS).removeClass('is-active');

    // Enable the new section and tab.
    $(sectionNameSelector).addClass('is-active');
    $tabElement.addClass('is-active');

    // Populate it if this is our first hit.
    if (!sectionController.firstFetchAttempted()) {
      sectionController.doFetch();
    }
  };

  $(SELECTOR_USER_CONTRIBUTIONS_TABS).on('click', _handleTabClick);

  let fetchEndpointBase = location.origin + '/min-side/contributions';

  $(SELECTOR_USER_CONTRIBUTIONS_SECTIONS).each((index, section) => {
    const $sectionElement = $(section);
    const fetchEndpoint = fetchEndpointBase + '/' + $sectionElement.data('section');
    // TODO - We could initialize from the browsers history if we have it
    // available.
    const controller = UserContributionsLoader({
      $sectionElement, fetchEndpoint
    });
    $sectionElement.data('controller', controller);
  });

  $(SELECTOR_DEFAULT_USER_CONTRIBUTIONS_TAB).click();
}

// If the path is right - let's initialize
if(decodeURIComponent(location.pathname) === '/min-side') {
  $(initialize);
}
