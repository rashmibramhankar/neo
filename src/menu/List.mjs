import BaseList  from '../list/Base.mjs';
import ListModel from '../selection/menu/ListModel.mjs';
import NeoArray  from '../util/Array.mjs';
import Store     from './Store.mjs';

/**
 * @class Neo.menu.List
 * @extends Neo.list.Base
 */
class List extends BaseList {
    static config = {
        /**
         * @member {String} className='Neo.menu.List'
         * @protected
         */
        className: 'Neo.menu.List',
        /**
         * @member {String} ntype='menu-list'
         * @protected
         */
        ntype: 'menu-list',
        /**
         * Read only. We are storing the currently visible subMenu instance.
         * @member {Neo.menu.List|Neo.menu.Panel|null} activeSubMenu=null
         */
        activeSubMenu: null,
        /**
         * @member {String[]} baseCls=['neo-menu-list','neo-list']
         */
        baseCls: ['neo-menu-list', 'neo-list'],
        /**
         * True will add 'neo-floating' to the instance cls list.
         * @member {Boolean} floating_=false
         */
        floating_: false,
        /**
         * setTimeout() id after a focus-leave event.
         * @member {Number|null} focusTimeoutId=null
         * @protected
         */
        focusTimeoutId: null,
        /**
         * Hides a floating list on leaf item click, in case it has a parentComponent
         * @member {Boolean} hideOnLeafItemClick=true
         */
        hideOnLeafItemClick: true,
        /**
         * Optionally pass menu.Store data directly
         * @member {Object[]|null} items_=null
         */
        items_: null,
        /**
         * Internal flag.
         * Sub-menus will bubble of focus changes to the top level.
         * @member {Boolean} menuFocus_=false
         * @protected
         */
        menuFocus_: false,
        /**
         * Internal flag.
         * True for a top level menu, false for sub-menus.
         * @member {Boolean} isRoot=true
         * @protected
         */
        isRoot: true,
        /**
         * Storing the list item index of the parent menu in case it exists.
         * @member {Number} parentIndex=0
         * @protected
         */
        parentIndex: 0,
        /**
         * Storing a reference to the parent menu in case it exists.
         * @member {Neo.menu.List|Neo.menu.Panel|null} parentMenu=null
         * @protected
         */
        parentMenu: null,
        /**
         * Value for the list.Base selectionModel_ config
         * @member {Neo.selection.menu.ListModel} selectionModel=ListModel
         */
        selectionModel: ListModel,
        /**
         * Value for the list.Base store_ config
         * @member {Neo.menu.Store} store=Store
         */
        store: Store,
        /**
         * The distance in px between a menu and a child menu
         * See: https://github.com/neomjs/neo/issues/2569
         * @member {Number} subMenuGap=0
         */
        subMenuGap: 0,
        /**
         * Storing childMenus by record keyProperty
         * @member {Object} subMenuMap=null
         * @protected
         */
        subMenuMap: null,
        /**
         * We are applying a z-index style which is 1 number higher to each sub-menu
         * @member {Number} zIndex_=100
         */
        zIndex_: 100,
        /**
         * @member {Object} _vdom
         */
        _vdom:
        {tag: 'ul', tabIndex: -1, cn: []}
    }

    /**
     * If the menu is floating, it will anchor itself to the parentRect
     * @member {Neo.component.Base|null} parentComponent=null
     */
    parentComponent = null

    /**
     * Triggered after the floating config got changed
     * @param {Object[]} value
     * @param {Object[]} oldValue
     * @protected
     */
    afterSetFloating(value, oldValue) {
        let cls = this.cls;

        NeoArray[value ? 'add' : 'remove'](cls, 'neo-floating');
        this.cls = cls
    }

    /**
     * Triggered after the items config got changed
     * @param {Object[]} value
     * @param {Object[]} oldValue
     * @protected
     */
    afterSetItems(value, oldValue) {
        let store = this.store;

        oldValue && store.remove(oldValue);
        value    && store.add(value)
    }

    /**
     * Triggered after the menuFocus config got changed
     * @param {Boolean} value
     * @param {Boolean} oldValue
     * @protected
     */
    afterSetMenuFocus(value, oldValue) {
        if (oldValue !== undefined) {
            let me = this;

            if (me.isRoot) {
                if (!value) {
                    me.focusTimeoutId = setTimeout(() => {
                        me[me.floating ? 'unmount' : 'hideSubMenu']();
                    }, 20);
                } else {
                    clearTimeout(me.focusTimeoutId);
                    me.focusTimeoutId = null;
                }
            } else {
                // bubble the focus change upwards
                me.parentMenu.menuFocus = value;
            }
        }
    }

    /**
     * Triggered after the mounted config got changed
     * @param {Boolean} value
     * @param {Boolean} oldValue
     * @protected
     */
    afterSetMounted(value, oldValue) {
        super.afterSetMounted(value, oldValue);

        let me           = this,
            id           = me.id,
            parentId     = me.parentComponent?.id;

        if (parentId) {
            if (value) {
                Neo.main.addon.ScrollSync.register({
                    sourceId: parentId,
                    targetId: id
                });

                !me.parentMenu && me.getDomRect([id, parentId]).then(rects => {
                    let style = me.style || {};

                    style.left = `${rects[1].right - rects[0].width}px`;
                    style.top  = `${rects[1].bottom + 1}px`;

                    me.style = style
                })
            } else if (oldValue !== undefined) {
                Neo.main.addon.ScrollSync.unregister({
                    sourceId: parentId,
                    targetId: id
                })
            }
        }
    }

    /**
     * Triggered after the zIndex config got changed
     * @param {Number} value
     * @param {Number} oldValue
     * @protected
     */
    afterSetZIndex(value, oldValue) {
        this.style = {...this.style, zIndex: value}
    }

    /**
     * Override this method for custom renderers
     * @param {Object} record
     * @param {Number} index
     * @returns {Object|Object[]|String} Either a config object to assign to the item, a vdom cn array or a html string
     */
    createItemContent(record, index) {
        let me      = this,
            iconCls = record.iconCls,
            id      = record[me.store.keyProperty],
            vdomCn  = [{tag: 'span', cls: ['neo-content'], html: record[me.displayField]}];

        if (iconCls && iconCls !== '') {
            vdomCn.unshift({tag: 'i', cls: ['neo-menu-icon', 'neo-icon', iconCls], id: me.getIconId(id)});
        }

        if (me.hasChildren(record)) {
            vdomCn.push({tag: 'i', cls: ['neo-arrow-icon', 'neo-icon', 'fas fa-chevron-right'], id: me.getArrowIconId(id)});
        }

        return vdomCn
    }

    /**
     *
     */
    destroy(...args) {
        let me            = this,
            activeSubMenu = me.activeSubMenu,
            subMenuMap    = me.subMenuMap;

        me.store.destroy();

        activeSubMenu?.unmount();

        Object.entries(subMenuMap).forEach(([key, value]) => {
            value.destroy();
            subMenuMap[key] = null
        });

        super.destroy(...args)
    }

    /**
     * @param {Number|String} recordId
     * @returns {String}
     */
    getArrowIconId(recordId) {
        return `${this.id}__arrow_icon__${recordId}`
    }

    /**
     * @param {Number|String} recordId
     * @returns {String}
     */
    getIconId(recordId) {
        return `${this.id}__icon__${recordId}`
    }

    /**
     * recordIds can be Numbers, so we do need a prefix
     * @param {Number|String} recordId
     * @returns {String}
     */
    getMenuMapId(recordId) {
        return `menu__${recordId}`
    }

    /**
     * Checks if a record has items
     * @param {Object} record
     * @returns {Boolean}
     */
    hasChildren(record) {
        return Array.isArray(record.items) && record.items.length > 0
    }

    /**
     *
     */
    hideSubMenu() {
        let me            = this,
            activeSubMenu = me.activeSubMenu;

        if (activeSubMenu) {
            activeSubMenu.unmount();
            me.activeSubMenu = null
        }
    }

    /**
     * @param {Object} data
     * @param {Object[]} data.path
     */
    onFocusEnter(data) {
        this.menuFocus = true
    }

    /**
     * @param {Object} data
     * @param {Object[]} data.oldPath
     */
    onFocusLeave(data) {
        let insideParent = false,
            parentId     = this.parentComponent?.id,
            item;

        if (parentId) {
            for (item of data.oldPath) {
                if (item.id === parentId) {
                    insideParent = true;
                    break;
                }
            }
        }

        if (!insideParent) {
            this.menuFocus = false
        }
    }

    /**
     * @param {Object} node
     * @param {Object} data
     */
    onItemClick(node, data) {
        super.onItemClick(node, data);

        this.onKeyDownEnter(node.id)
    }

    /**
     * @param {String} nodeId
     */
    onKeyDownEnter(nodeId) {
        if (nodeId) {
            let me       = this,
                recordId = me.getItemRecordId(nodeId),
                record   = me.store.get(recordId),
                submenu;

            record.handler?.call(me, record);

            if (me.hideOnLeafItemClick && !record.items) {
                me.unmount()
            }

            if (record.items) {
                submenu = me.subMenuMap?.[me.getMenuMapId(recordId)];

                if (submenu) {
                    me.toggleSubMenu(nodeId, record)
                }
            }
        }
    }

    /**
     * @param {Object} data
     */
    onKeyDownEscape(data) {
        this.floating && this.unmount()
    }

    /**
     * @param {String[]} items
     */
    onSelect(items) {
        let me       = this,
            nodeId   = items[0],
            recordId = me.getItemRecordId(nodeId),
            record   = me.store.get(recordId);

        if (me.activeSubMenu !== me.subMenuMap?.[me.getMenuMapId(recordId)]) {
            me.hideSubMenu();
            me.hasChildren(record) && me.showSubMenu(nodeId, record)
        }
    }

    /**
     * @param {String} nodeId
     * @param {Object} record
     */
    showSubMenu(nodeId, record) {
        let me           = this,
            store        = me.store,
            recordId     = record[store.keyProperty],
            subMenuMap   = me.subMenuMap || {},
            subMenuMapId = me.getMenuMapId(recordId),
            subMenu      = subMenuMap[subMenuMapId],
            menuStyle, style;

        me.getDomRect(nodeId).then(rect => {
            style = {
                left: `${rect.right + me.subMenuGap}px`,
                top : `${rect.top - 1}px` // minus the border
            };

            if (subMenu) {
                menuStyle = subMenu.style;

                Object.assign(menuStyle, style);

                subMenu.setSilent({style: menuStyle})
            } else {
                subMenuMap[subMenuMapId] = subMenu = Neo.create({
                    module         : List,
                    appName        : me.appName,
                    displayField   : me.displayField,
                    floating       : true,
                    items          : record.items,
                    isRoot         : false,
                    parentComponent: me.parentComponent,
                    parentId       : Neo.apps[me.appName].mainView.id,
                    parentIndex    : store.indexOf(record),
                    parentMenu     : me,
                    style,
                    zIndex         : me.zIndex + 1
                })
            }

            me.activeSubMenu = subMenu;
            me.subMenuMap    = subMenuMap;

            subMenu.render(true)
        });
    }

    /**
     * @param {String} nodeId
     * @param {Object} record
     */
    toggleSubMenu(nodeId, record) {
        let me       = this,
            recordId = record[me.getKeyProperty()],
            submenu  = me.subMenuMap?.[me.getMenuMapId(recordId)];

        if (!submenu || !submenu.mounted) {
            me.showSubMenu(nodeId, record)
        } else {
            me.hideSubMenu()
        }
    }

    /**
     *
     */
    unmount() {
        this.selectionModel.deselectAll(true); // silent update
        this.hideSubMenu();

        super.unmount()
    }
}

Neo.applyClassConfig(List);

export default List;
