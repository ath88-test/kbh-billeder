/**
 * Render out the header and footer menus on the page.
 */
var keystone = require('keystone');
const MENUS = ['main', 'footer'];
let app;

async function BuildMenu() {

  /**
   * Model object from Mongo, initialized by reload().
   */
  let MenuItemList;

  /**
   * An object that contains the finished menu, initialized by reload().
   */
  let menus = {};

  /**
   * Query mongo for list of menu items with no parents - ie root menu items.
   *
   * @param menuName
   *   The name of the menu we should find root items for.
   *
   * @returns
   *   Promise that populates menus[menuname].
   */
  const _populateRootMenus = (menuName) => {
    // Find all items in the menu without parents.
    return MenuItemList.model.find({
      placement: menuName,
      parent: null
    })
      // Instantiate references to pages.
      .populate(['page'])
      .sort('order')
      // Find the url for each item (resolve either page-references or use the
      // link property.
      .exec(function(err, items) {
        items.forEach((item) => {
          item.url = item.getUrl();
          item.children = [];
          // Add the menu-item to our global menu.
          menus[menuName].push(item);
        });
      });
  };

  /**
   * Generate child items for a root menu item.
   *
   * We currently don't recurse, so this will only build a single sub-level.
   *
   * @param menuName
   *   Name of the menu we're working on.
   *
   * @returns
   *   Promise that adds children to root menus of menus[menuname]
   */
  const _populateSubmenus = (menuName) => {
    const menuItems = menus[menuName];

    // Go trough all root-level menu-items of the menu, keep track of the
    // index as we need it for writing to the global menu.
    return Promise.all(menuItems.map((parent, parentMenuIndex) => {
      // Seek out all chield elements that points to the parent.
      return MenuItemList.model.find({
        parent: parent._id
      })
        .populate(['page'])
        .sort('order')
        .exec(function (err, childItems) {
          // Prepare each child and add it to the menu.
          childItems.forEach(child => {
            child.url = child.getUrl();
            menus[menuName][parentMenuIndex].children.push(child);
          });
        });
    }));
  };

  // Start the build by fetching the model object for menu items.
  MenuItemList = keystone.list('Menu item');

  // Make sure we have an entry for each menu.
  MENUS.forEach(name => {
    menus[name] = [];
  });

  // Build up root-level menus.
  await Promise.all(MENUS.map((menuName) => {
    return _populateRootMenus(menuName);
  }));

  // Populate any root-elvel menus with their children.
  await Promise.all(MENUS.map(menuName => {
    return _populateSubmenus(menuName);
  }));
  return menus;
};

async function BuildMessages() {
  MessageList = keystone.list('Site message');
  let messages = await MessageList.model.find({});
  return messages;
};

module.exports = function(expressApp) {
  app = expressApp;
};

module.exports.buildMenu = BuildMenu;
module.exports.buildMessages = BuildMessages;
module.exports.MENUS = MENUS;
