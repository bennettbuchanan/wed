/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013-2015 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:wed */function (require, exports, module) {
'use strict';

var core = require("./wed_core");
var Editor = core.Editor;
var wed_util = require("./wed_util");
var getAttrValueNode = wed_util.getAttrValueNode;
var $ = require("jquery");
var browsers = require("./browsers");
var _ = require("lodash");
var log = require("./log");
var rangy = require("rangy");
var util = require("./util");
var domutil = require("./domutil");
var dloc = require("./dloc");
var makeDLoc = dloc.makeDLoc;
var DLoc = dloc.DLoc;
require("bootstrap");
require("jquery.bootstrap-growl");
var closestByClass = domutil.closestByClass;
var closest = domutil.closest;
var indexOf = domutil.indexOf;

var getOriginalName = util.getOriginalName;

Editor.prototype.dumpCaretInfo = function () {
    var data_caret = this.getDataCaret();

    if (data_caret)
        console.log("data caret", data_caret.node, data_caret.offset);
    else
        console.log("no data caret");

    if (this._sel_anchor)
        console.log("selection anchor",
                    this._sel_anchor.node, this._sel_anchor.offset);
    else
        console.log("no selection anchor");

    if (this._sel_focus)
        console.log("selection focus",
                    this._sel_focus.node, this._sel_focus.offset);
    else
        console.log("no selection focus");

    if (this._sel_focus)
        console.log("selection focus closest real",
                    closestByClass(this._sel_focus.node, "_real",
                                   this.gui_root));

    domutil.dumpRange("DOM range: ", this._getDOMSelectionRange());
    console.log("input field location", this._$input_field.css("top"),
                this._$input_field.css("left"));
    console.log("document.activeElement", document.activeElement);

    var node = this._sel_focus.node;
    if (node.nodeType === Node.TEXT_NODE) {
        var offset = this._sel_focus.offset;
        if (offset < node.data.length) {
            var range = this.doc.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            var rect = range.getBoundingClientRect();
            console.log("rectangle around character at caret:", rect);
        }
    }
};

Editor.prototype.caretPositionRight = function () {
    return this.positionRight(this._sel_focus);
};

Editor.prototype.positionRight = function (pos) {

    // We are looking for the ``el`` such that ``pos.node`` is
    // PRECEDING. (If ``pos.node`` CONTAINS ``el``, it is also
    // PRECEDING).
    function nextAttrFilter(el) {
        return (el.compareDocumentPosition(pos.node) &
                Node.DOCUMENT_POSITION_PRECEDING);
    }

    if (pos === undefined || pos === null)
        return undefined; // nothing to be done

    var root = pos.root;
    // If we are in a placeholder node, immediately move out of it.
    var closest_ph = closestByClass(pos.node, "_placeholder", root);
    if (closest_ph)
        pos = pos.make(closest_ph.parentNode,
                       indexOf(closest_ph.parentNode.childNodes,
                               closest_ph) + 1);

    while(true)
    {
        var gui_before = closestByClass(pos.node, "_gui", root);

        // This takes care of the special case where we have an empty
        // document that contains only a placeholder. In such case,
        // setting the container to this.gui_root.firstChild will have
        // a perverse effect of setting the container to be **inside**
        // the current pos.
        var container = this.gui_root.firstChild;
        if (container.classList.contains("_placeholder"))
            container = this.gui_root;

        pos = pos.make(
            domutil.nextCaretPosition(pos.toArray(), container, false));
        if (!pos)
            break;

        var node = pos.node;
        var offset = pos.offset;
        var closest_gui = closest(node, "._gui:not(._invisible)", root);
        if (closest_gui) {
            var start_label = closest_gui.classList.contains("__start_label");
            if (this.attributes === "edit" && start_label) {
                if (closestByClass(node, "_attribute_value", root))
                    // We're in an attribute value, stop here.
                    break;

                // Already in the element name, or in a previous
                // attribute, move from attribute to attribute.
                if (closest(node, "._element_name, ._attribute", root)) {
                    // Search for the next attribute.
                    var next_attr = _.find(
                        closest_gui.getElementsByClassName("_attribute"),
                        nextAttrFilter);

                    if (next_attr) {
                        // There is a next attribute: move to it.
                        var val = domutil.childByClass(next_attr,
                                                       "_attribute_value");
                        val = getAttrValueNode(val);
                        pos = pos.make(val, 0);
                        break;
                    }
                }
                // else fall through and move to end of gui element.
            }

            if (gui_before === closest_gui) {
                // Move to the end of the gui element ...
                pos = pos.make(closest_gui, closest_gui.childNodes.length);
                // ... and then out of it.
                continue;
            }
            pos = pos.make(
                // If in a label, normalize to element name. If in
                // another kind of gui element, normalize to start of
                // the element.
                (start_label || closestByClass(node, "_label", closest_gui))?
                    node.getElementsByClassName("_element_name")[0] :
                    closest_gui, 0);
            // ... stop here.
            break;
        }

        // Can't stop inside a phantom node.
        var closest_phantom = closestByClass(node, "_phantom", root);
        if (closest_phantom) {
            // This ensures the next loop will move after the phantom.
            pos = pos.make(closest_phantom, closest_phantom.childNodes.length);
            continue;
        }

        // Or beyond the first position in a placeholder node.
        closest_ph = closestByClass(node, "_placeholder", root);
        if (closest_ph && offset > 0) {
            // This ensures the next loop will move after the placeholder.
            pos = pos.make(closest_ph, closest_ph.childNodes.length);
            continue;
        }

        // Make sure the position makes sense from an editing
        // standpoint.
        if (node.nodeType === Node.ELEMENT_NODE) {
            var next_node = node.childNodes[offset];

            // Always move into text
            if (next_node && next_node.nodeType === Node.TEXT_NODE)
                continue;

            var prev_node = node.childNodes[offset - 1];
            // Stop between two decorated elements.
            if (next_node && prev_node &&
                // The tests for firstChild and lastChild make the
                // two following tests unnecessary:
                //
                // next_node.nodeType === Node.ELEMENT_NODE &&
                // prev_node.nodeType === Node.ELEMENT_NODE &&
                next_node.firstChild &&
                next_node.firstChild.nodeType === Node.ELEMENT_NODE &&
                next_node.firstChild.classList.contains("_gui") &&
                !next_node.firstChild.classList.contains("_invisible") &&
                prev_node.lastChild &&
                prev_node.lastChild.nodeType === Node.ELEMENT_NODE &&
                prev_node.lastChild.classList.contains("_gui") &&
                !prev_node.lastChild.classList.contains("_invisible"))
                break;

            if (prev_node &&
                prev_node.nodeType === Node.ELEMENT_NODE &&
                // We do not stop in front of element nodes.
                (next_node &&
                 (next_node.nodeType === Node.ELEMENT_NODE &&
                  !next_node.classList.contains("_end_wrapper") &&
                  !prev_node.classList.contains("_start_wrapper")) ||
                 prev_node.matches(
                     "._wed-validation-error, ._gui.__end_label")))
                continue; // can't stop here

            var nodes = this.mode.nodesAroundEditableContents(node);

            // If the element has nodes before editable contents and
            // the caret would be before or among such nodes, then ...
            if (nodes[0] && indexOf(node.childNodes, nodes[0]) >= offset)
                continue; // ... can't stop here.

            // If the element has nodes after editable contents and
            // the caret would be after or among such nodes, then ...
            if (nodes[1] && indexOf(node.childNodes, nodes[1]) < offset)
                continue; // ... can't stop here.
        }

        // If we get here, the position is good!
        break;
    }

    return pos || undefined;
};

Editor.prototype.caretPositionLeft = function () {
    return this.positionLeft(this._sel_focus);
};

Editor.prototype.positionLeft = function (pos) {
    if (pos === undefined || pos === null)
        return undefined; // nothing to be done

    var root = pos.root;
    // If we are in a placeholder node, immediately move out of it.
    var closest_ph = closestByClass(pos.node, "_placeholder", root);
    if (closest_ph)
        pos = pos.make(closest_ph.parentNode,
                       indexOf(closest_ph.parentNode.childNodes, closest_ph));

    while(true)
    {
        var el_name = closestByClass(pos.node, "_element_name", root);
        var was_in_name = el_name && (pos.node === el_name) &&
                (pos.offset === 0);

        // This takes care of the special case where we have an empty
        // document that contains only a placeholder. In such case,
        // setting the container to this.gui_root.firstChild will have
        // a perverse effect of setting the container to be **inside**
        // the current pos.
        var container = this.gui_root.firstChild;
        if (container.classList.contains("_placeholder"))
            container = this.gui_root;

        pos = pos.make(domutil.prevCaretPosition(pos.toArray(),
                                                 container,
                                                 false));
        if (!pos)
            break;

        var node = pos.node;
        var offset = pos.offset;
        var closest_gui = closest(node, "._gui:not(._invisible)", root);
        if (closest_gui) {
            var start_label = closest_gui.classList.contains("__start_label");
            if (this.attributes === "edit" && start_label && !was_in_name) {

                if (closestByClass(node, "_attribute_value", closest_gui))
                    // We're in an atribute value, stop here.
                    break;

                var attr = closestByClass(node, "_attribute", closest_gui);
                if (!attr &&
                    node.nextElementSibling &&
                    node.nextElementSibling.classList.contains("_attribute"))
                    attr = node.nextElementSibling;

                if (!attr) {
                    el_name = closestByClass(node, "_element_name",
                                             closest_gui);
                    attr = el_name && el_name.nextElementSibling;
                }

                var prev_attr = attr && attr.previousElementSibling;

                // If we have not yet found anything, then the
                // previous attribute is the last one.
                if (!prev_attr) {
                    var all = closest_gui.getElementsByClassName("_attribute");
                    prev_attr = all[all.length - 1];
                }

                // Eliminate those elements which are not attributes.
                if (prev_attr &&
                    !prev_attr.classList.contains("_attribute"))
                    prev_attr = null;

                if (prev_attr) {
                    // There is a previous attribute: move to it.
                    var val = domutil.childByClass(prev_attr,
                                                   "_attribute_value");
                    offset = 0;
                    if (val.lastChild) {
                        val = val.lastChild;
                        offset = val.length;
                        if (val.classList &&
                            val.classList.contains("_placeholder"))
                            offset = 0;
                    }
                    pos = pos.make(val, offset);
                    break;
                }

            }

            if (!was_in_name) {
                pos = pos.make(
                    // If we are in any label, normalize to the
                    // element name, otherwise normalize to the first
                    // position in the gui element.
                    (start_label ||
                     closestByClass(node, "_label", closest_gui)) ?
                        closest_gui.getElementsByClassName("_element_name")[0]
                        : closest_gui,
                        0);
                break;
            }

            // ... move to start of gui element ...
            pos = pos.make(closest_gui, 0);
            // ... and then out of it.
            continue;
        }

        closest_ph = closestByClass(node, "_placeholder", root);
        if (closest_ph) {
            // Stopping in a placeholder is fine, but normalize
            // the position to the start of the text.
            pos = pos.make(closest_ph.firstChild, 0);
            break;
        }

        // Can't stop inside a phantom node.
        var closest_phantom = closestByClass(node, "_phantom", root);
        if (closest_phantom)
        {
            // Setting the position to this will ensure that on the
            // next loop we move to the left of the phantom node.
            pos = pos.make(closest_phantom, 0);
            continue;
        }

        // Make sure the position makes sense from an editing
        // standpoint.
        if (node.nodeType === Node.ELEMENT_NODE) {
            var prev_node = node.childNodes[offset - 1];

            // Always move into text
            if (prev_node && prev_node.nodeType === Node.TEXT_NODE)
                continue;

            var next_node = node.childNodes[offset];
            // Stop between two decorated elements.
            if (next_node && prev_node &&
                // The tests for firstChild and lastChild make the
                // two following tests unnecessary:
                //
                // next_node.nodeType === Node.ELEMENT_NODE &&
                // prev_node.nodeType === Node.ELEMENT_NODE &&
                next_node.firstChild &&
                next_node.firstChild.nodeType === Node.ELEMENT_NODE &&
                next_node.firstChild.classList.contains("_gui") &&
                !next_node.firstChild.classList.contains("_invisible") &&
                prev_node.lastChild &&
                prev_node.lastChild.nodeType === Node.ELEMENT_NODE &&
                prev_node.lastChild.classList.contains("_gui") &&
                !prev_node.lastChild.classList.contains("_invisible"))
                break;

            if (next_node &&
                next_node.nodeType === Node.ELEMENT_NODE &&
                // We do not stop just before a start tag button.
                (prev_node &&
                 (prev_node.nodeType === Node.ELEMENT_NODE &&
                  !prev_node.classList.contains("_start_wrapper") &&
                  !next_node.classList.contains("_end_wrapper")) ||
                 // Can't stop right before a validation error.
                 next_node.matches(
                     "._gui.__start_label, .wed-validation-error")))
                continue; // can't stop here

            var nodes = this.mode.nodesAroundEditableContents(node);

            // If the element has nodes before editable contents and
            // the caret would be before or among such nodes, then ...
            if (nodes[0] && indexOf(node.childNodes, nodes[0]) >= offset)
                continue; // ... can't stop here.

            // If the element has nodes after editable contents and
            // the caret would be after or among such nodes, then ...
            if (nodes[1] && indexOf(node.childNodes, nodes[1]) < offset)
                continue; // ... can't stop here.

        }

        // If we get here, the position is good!
        break;
    }

    return pos || undefined;
};

Editor.prototype.moveCaretRight = function () {
    var pos = this.caretPositionRight();
    if (pos)
        this.setGUICaret(pos);
};

Editor.prototype.moveCaretLeft = function () {
    var pos = this.caretPositionLeft();
    if (pos)
        this.setGUICaret(pos);
};

/**
 * Sets the caret position in the GUI tree.
 *
 * @param {module:dloc~DLoc} loc The new position.
 *
 * @also
 *
 * @param {Node} node The node in the GUI tree where to put the caret.
 * @param {number} offset The offset in the node.
 */
Editor.prototype.setGUICaret = function (loc, offset) {
    this._setGUICaret(loc, offset);
};

/**
 * Sets the caret position in the GUI tree.
 *
 * @private
 * @param {module:dloc~DLoc} loc The new position.
 * @param {string} op The operation which is causing the caret to
 * move. See {@link module:wed~Editor#_caretChange _caretChange} for
 * the possible values.
 *
 * @also
 *
 * @param {Node} node The node in the GUI tree where to put the caret.
 * @param {number} offset The offset in the node.
 * @param {string} op The operation which is causing the caret to
 * move. See {@link module:wed~Editor#_caretChange _caretChange} for
 * the possible values.
 */
Editor.prototype._setGUICaret = function (loc, offset, op) {
    var node;
    if (loc instanceof DLoc) {
        op = offset;
        offset = loc.offset;
        node = loc.node;
    }
    else {
        node = loc;
        loc = makeDLoc(this.gui_root, node, offset);
    }

    // We accept a location which has for ``node`` a node which is an
    // _attribute_value with an offset. However, this is not an
    // actually valid caret location. So we normalize the location to
    // point inside the text node that contains the data.
    if (node.classList &&
        node.classList.contains("_attribute_value")) {
        var attr = getAttrValueNode(node);
        if (node !== attr) {
            node = attr;
            loc = loc.make(node, offset);
        }
    }

    // Don't update if noop.
    if (this._sel_focus &&
        this._sel_anchor === this._sel_focus &&
        this._sel_focus.node === node &&
        this._sel_focus.offset === offset)
        return;

    this._clearDOMSelection();
    this._sel_anchor = loc;
    this._sel_focus = this._sel_anchor;
    this._refreshFakeCaret();
    this._focusInputField();
    this._caretChange(op);
};


Editor.prototype._focusInputField = function () {
    // The following call was added to satisfy IE 11. The symptom is that
    // when clicking on an element's label **on a fresh window that
    // has never received focus**, it is not possible to move off the
    // label using the keyboard. This issue happens only with IE
    // 11.
    this.my_window.focus();
    // The call to blur here is here ***only*** to satisfy Chrome 29!
    this._$input_field.blur();
    this._$input_field.focus();
};

Editor.prototype._blur = log.wrap(function (ev) {
    if (!this._sel_focus)
        return;
    this._sel_anchor_at_blur = this._sel_anchor;
    this._sel_focus_at_blur = this._sel_focus;

    this._$input_field.blur();
    this._sel_anchor = undefined;
    this._sel_focus = undefined;
    this._refreshFakeCaret();
});

/**
 * Registers elements that are outside wed's editing pane but should
 * be considered to be part of the editor. These would typically be
 * menus or toolbars that a larger application that uses wed for
 * editing adds around the editing pane.
 *
 * @param {Node|jQuery|Array.<Node>} elements The elements to
 * register.
 */
Editor.prototype.excludeFromBlur = function(elements) {
    this._$excluded_from_blur.add(elements);
};

Editor.prototype._focus = log.wrap(function (ev) {
    if (this._sel_anchor_at_blur) {
        this._sel_anchor = this._sel_anchor_at_blur;
        this._sel_focus = this._sel_focus_at_blur;
        // If something has scrolled the editor pane between the loss
        // of focus and our regaining it, we should preserve the
        // scrolling. In particular, this happens in Chrome when the
        // user uses the search function to search text on the
        // page. Chrome will scroll the page to the hit. Without
        // keeping the scroll intact, then the user loses their
        // position when they click into the window to (for instance)
        // select the hit.
        var top = this.gui_root.scrollTop;
        var left = this.gui_root.scrollLeft;
        this._restoreCaretAndSelection(true);
        this.gui_root.scrollTop = top;
        this.gui_root.scrollLeft = left;
        this._sel_anchor_at_blur = undefined;
        this._sel_focus_at_blur = undefined;
    }
});

Editor.prototype._inhibitFakeCaret = function () {
    this._inhibited_fake_caret++;
};

Editor.prototype._uninhibitFakeCaret = function () {
    this._inhibited_fake_caret--;
    if (this._inhibited_fake_caret < 0)
        throw new Error("too many calls to _uninhibitFakeCaret");
    if (this._pending_fake_caret_refresh) {
        this._refreshFakeCaret();
        this._pending_fake_caret_refresh = false;
    }
};



Editor.prototype._refreshFakeCaret = function () {
    if (this._inhibited_fake_caret) {
        this._pending_fake_caret_refresh = true;
        return;
    }

    var node, offset, root;
    if (this._sel_focus) {
        node = this._sel_focus.node;
        offset = this._sel_focus.offset;
        root = this._sel_focus.root;
    }

    if (!node)
        return;

    var position, height;
    switch (node.nodeType)
    {
    case Node.TEXT_NODE:
        var parent = node.parentNode;
        var prev = node.previousSibling;
        var next = node.nextSibling;
        domutil.insertIntoText(node, offset, this._fc_mark);
        break;
    case Node.ELEMENT_NODE:
        node.insertBefore(this._fc_mark, node.childNodes[offset] || null);
        break;
    default:
        throw new Error("unexpected node type: " + node.nodeType);
    }

    position = this._fc_mark.getBoundingClientRect();

    //
    // The position is relative to the *screen*. We need to make it
    // relative to the start of _scroller.
    //
    var gr_position = this._scroller.getBoundingClientRect();
    position = {top: position.top - gr_position.top,
                left: position.left - gr_position.left};

    height = this._$fc_mark.height();

    if (node.nodeType === Node.TEXT_NODE) {
        // node was deleted from the DOM tree by the insertIntoText
        // operation, we need to bring it back.

        // We delete everything after what was prev to the original
        // node, and before what was next to it.
        var delete_this = prev ? prev.nextSibling : parent.firstChild;
        while(delete_this !== next) {
            parent.removeChild(delete_this);
            delete_this = prev ? prev.nextSibling : parent.firstChild;
        }
        parent.insertBefore(node, next || null);
    }
    else
        this._fc_mark.parentNode.removeChild(this._fc_mark);

    // It can happen that a refresh is triggered while the selection
    // is invalid. We do not want to try setting the selection in such
    // a case.
    if (this._sel_anchor.isValid() && this._sel_focus.isValid()) {
        // Restore the range.
        var rr = this._sel_anchor.makeRange(this._sel_focus);
        // We *must not* restore the range if it is collapsed because
        // this will cause a problem with scrolling. (The pane will
        // jump up and down while scrolling.)
        if (!rr.range.collapsed)
            this._setDOMSelectionRange(rr.range, rr.reversed);
    }

    this._fake_caret.style.top = position.top + "px";
    this._fake_caret.style.left = position.left + "px";
    this._fake_caret.style.height = height + "px";
    this._fake_caret.style.maxHeight = height + "px";
    this._fake_caret.style.minHeight = height + "px";

    // The fake caret is removed from the DOM when not in use, reinsert it.
    if (!this._fake_caret.parentNode)
        this._caret_layer.appendChild(this._fake_caret);

    if (this._$input_field[0].style["z-index"] > 0) {
        this._$input_field.css("top", position.top);
        this._$input_field.css("left", position.left);
    }
    else {
        this._$input_field.css("top", "");
        this._$input_field.css("left", "");
    }
};

/**
 * Finds the location of the character closest to the ``x, y``
 * coordinates. Very often this will be the character whose bounding
 * client rect encloses the coordinates. However, if no such character
 * exists the algorithm will return the closest character. If multiple
 * characters are at the same distance, then the first one found will
 * be returned.
 *
 * @private
 * @param {number} x The x coordinate in client coordinates.
 * @param {number} y The y coordinate in client coordinates.
 * @returns {module:dloc~DLoc|undefined} The location of the boundary
 * character. The value return is ``undefined`` if the coordinates are
 * outside the client or if the element in which the click occurred is
 * not inside the editor pane (a descendant of ``this.gui_root``).
 */
Editor.prototype._findLocationAt = function (x, y) {
    var element_at_mouse = this.elementAtPointUnderLayers(x, y);
    // This could happen if x, y is outside our screen.
    if (!element_at_mouse)
        return undefined;

    // The element_at_mouse is not in the editing pane.
    if (!this.gui_root.contains(element_at_mouse))
        return undefined;

    return this._findLocationInElementAt(element_at_mouse, x, y);
};


Editor.prototype._findLocationInElementAt = function(node, x, y, text_ok) {
    if (text_ok !== false)
        text_ok = true;

    var range = this.doc.createRange();

    var min;

    // Check function for the general case (not IE). In the general
    // case, ``rects`` will always be undefined. When the IE check
    // function calls it, it may be defined to a pre-built rect.
    function checkRangeNormal(node, start, rects) {
        if (!rects) {
            if (node.nodeType === Node.TEXT_NODE) {
                range.setStart(node, start);
                range.setEnd(node, start + 1);
                rects = [range.getBoundingClientRect()];
            }
            else
                rects = node.childNodes[start].getClientRects();
        }

        for(var rect_ix = 0, rect; (rect = rects[rect_ix]) !== undefined;
            ++rect_ix) {
            // Not a contender...
            if (rect.height === 0 && rect.width === 0)
                continue;

            var dist = util.distsFromRect(x, y, rect.left, rect.top,
                                          rect.right, rect.bottom);
            if (!min || min.dist.y > dist.y ||
                (min.dist.y === dist.y && min.dist.x > dist.x)) {
                min = {
                    dist: dist,
                    node: node,
                    start: start
                };

                // Returning true means the search can end.
                return (dist.y === 0 && dist.x === 0);
            }
        }

        return false;
    }

    function checkRangeIE(node, start) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.length === 0)
                return false;

            if (node.length === 1)
                return checkRangeNormal(node, start);

            var prev_rect, next_rect, rect;
            if (start > 0 && start < node.length - 1) {
                range.setStart(node, start - 1);
                range.setEnd(node, start);
                prev_rect = range.getBoundingClientRect();
                range.setStart(node, start + 1);
                range.setEnd(node, start + 2);
                next_rect = range.getBoundingClientRect();

                // The characters before and after the one we are
                // interested in are on different lines. So the character
                // we are looking at participates in the line break.
                if (prev_rect.top !== next_rect.top)
                    return false;
            }
            else if (start === 0) {
                range.setStart(node, start);
                range.setEnd(node, start + 1);
                rect = range.getBoundingClientRect();
                range.setStart(node, start + 1);
                range.setEnd(node, start + 2);
                next_rect = range.getBoundingClientRect();

                // We might be able to salvage a rectangle like in the
                // next case, but I've never seen a case like
                // this. The current safe thing to do is to reject
                // this character.
                if (rect.top !== next_rect.top)
                    return false;
            }
            else if (start === node.length - 1) {
                range.setStart(node, start);
                range.setEnd(node, start + 1);
                rect = range.getBoundingClientRect();
                range.setStart(node, start - 1);
                range.setEnd(node, start);
                prev_rect = range.getBoundingClientRect();

                if (rect.bottom !== prev_rect.bottom) {
                    // Perform the check with a rect salvaged from the
                    // information obtained from the previous character.
                    return checkRangeNormal(
                        node, start,
                        [{
                            top: rect.top,
                            left: prev_rect.right,
                            right: rect.right,
                            bottom: prev_rect.bottom
                        }]);
                }
            }
        }

        // Not problematic...
        return checkRangeNormal(node, start);
    }

    var checkRange = checkRangeNormal;

    if (browsers.MSIE || (browsers.CHROME_37 && browsers.WINDOWS)) {
        //
        // IE is a special case. There would presumably be a way to
        // test for this by creating a multiline paragraph on the
        // screen and then checking what rectangles are
        // returned. Maybe a future version of wed will do this. For
        // now, however, we use browsers.MSIE to determine that we are
        // running in IE and act accoringly.
        //
        // The problem being worked around here is what happens when
        // we query the rectangle around a space which the browser has
        // determined is where it will break a line. Chrome and FF
        // will return a rectangle with a width of 0, which is a
        // sensible value, as no space is dedicated to **this** space,
        // and the rectangle returned does not include in it the
        // rectangle of any other characters in the range. IE, on the
        // other hand, idiotically returns a rectangle which
        // encompasses the line of the character before the space and
        // the line of the character after the space. Basically, the
        // rectangle encompasses two lines and overlaps with a whole
        // bunch of other rectangles.
        //
        // The strategy here is to replace the usual checkRange
        // function with one which will skip the problematic
        // rects. This way, any work that must be done to work around
        // IE's moronic return values is born only by those who use
        // IE.
        //
        // Chrome 37 on Windows suffers from a similar problem. Chrome
        // 38 is fine. Chrome 36 is fine. See
        // https://code.google.com/p/chromium/issues/detail?id=412127.
        //
        checkRange = checkRangeIE;
    }

    var child = node.firstChild;
    var child_ix = 0;
    main_loop:
    while (child) {
        if (text_ok && child.nodeType === Node.TEXT_NODE) {
            for(var i = 0; i < child.length; ++i) {
                if (checkRange(child, i))
                    // Can't get any better than this.
                    break main_loop;
            }
        }
        else {
            if (checkRange(node, child_ix))
                // Can't get any better than this.
                break main_loop;
        }
        child = child.nextSibling;
        child_ix++;
    }

    if (!min)
        return makeDLoc(this.gui_root, node, 0);

    return makeDLoc(this.gui_root, min.node, min.start);
};

Editor.prototype._pointToCharBoundary = function(x, y) {
    // This obviously won't work for top to bottom scripts.
    // Probably does not work with RTL scripts either.
    var boundary = this._findLocationAt(x, y);
    if (boundary) {
        var node = boundary.node;
        var offset = boundary.offset;
        var node_type = node.nodeType;

        if (((node_type === Node.ELEMENT_NODE) &&
             (offset < node.childNodes.length)) ||
            ((node_type === Node.TEXT_NODE) && (offset < node.length))) {
            // Adjust the value we return so that the location returned is
            // the one closest to the x, y coordinates.

            var range = this.doc.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            var rect = range.getBoundingClientRect();
            switch(node_type) {
            case Node.TEXT_NODE:
                // We use positionRight/Left to adjust the position so that
                // the caret ends up in a location that makes sense from an
                // editing standpoint.
                var right = this.positionRight(boundary);
                var left = this.positionLeft(boundary.make(node, offset + 1));
                if (right && !left)
                    boundary = right;
                else if (left && !right)
                    boundary = left;
                else if (right && left)
                    boundary = (Math.abs(wed_util.boundaryXY(right).left - x) >=
                                Math.abs(wed_util.boundaryXY(left).left - x) ?
                                left : right);
                break;
            case Node.ELEMENT_NODE:
                // We don't use positionRight/Left here because we want to
                // skip over the *whole* element.
                var before;
                var pointed_node = node.childNodes[offset];
                if (pointed_node.nodeType ===  Node.ELEMENT_NODE) {
                    var closest = this._findLocationInElementAt(pointed_node,
                                                                x, y);
                    var limit = (closest.node.nodeType === Node.ELEMENT_NODE) ?
                            closest.node.childNodes.length - 1 : -1;
                    switch(closest.offset) {
                    case 0:
                        before = true;
                        break;
                    case limit:
                        before = false;
                        break;
                    }
                }

                if (before === undefined)
                    before = Math.abs(rect.left - x) < Math.abs(rect.right - x);

                if (!before)
                    boundary = boundary.make(node, offset + 1);

                break;
            default:
                throw new Error("unexpected node type: " + node_type);
            }
        }
    }
    return boundary;
};

/**
 * This method returns the current position of the GUI caret. However, it
 * sanitizes its return value to avoid providing positions where
 * inserting new elements or text is not allowed. One prime example of
 * this would be inside of a ``_placeholder`` or a ``_gui`` element.
 *
 * @param {boolean} raw If ``true``, the value returned is not normalized.
 * @returns {module:dloc~DLoc} The caret location. Callers must not
 * change the value they get.
 */
Editor.prototype.getGUICaret = function (raw) {
    // Caret is unset
    if (this._sel_focus === undefined)
        return undefined;

    if (raw)
        return this._sel_focus;

    // The node is not in the root. This could be due to a stale
    // location.
    if (!this.gui_root.contains(this._sel_focus.node))
        return undefined;

    if (!this._sel_focus.isValid())
        this._sel_focus = this._sel_focus.normalizeOffset();

    return this._normalizeCaret(this._sel_focus);
};


Editor.prototype._normalizeCaret = function (loc) {
    if (!loc)
        return loc;

    var pg = closestByClass(loc.node, "_placeholder", loc.root);
    // We are in a placeholder: make the caret be the parent of the
    // this node.
    if (pg) {
        var parent = pg.parentNode;
        return loc.make(parent, indexOf(parent.childNodes, pg));
    }

    return loc;
};


Editor.prototype.fromDataLocation = function (node, offset) {
    var ret = this._gui_updater.fromDataLocation(node, offset);

    var new_offset = ret.offset;
    node = ret.node;
    if(node.nodeType === Node.ELEMENT_NODE) {
        // Normalize to a range within the editable nodes. We could be
        // outside of them in an element which is empty, for instance.
        var pair = this.mode.nodesAroundEditableContents(node);
        var first_index = indexOf(node.childNodes, pair[0]);
        if (new_offset <= first_index)
            new_offset = first_index + 1;
        else {
            var second_index =
                    pair[1] ? indexOf(node.childNodes, pair[1]) :
                    node.childNodes.length;
            if (new_offset >= second_index)
                new_offset = second_index;
        }
    }
    return ret.make(node, new_offset);
};

/**
 * Converts a gui location to a data location.
 *
 * @param {module:dloc~DLoc} loc A location in the GUI tree.
 * @param {Boolean} [closest=false] Some GUI locations do not
 * correspond to data locations. Like if the location is in a gui
 * element or phantom text. By default, this method will return
 * undefined in such case. If this parameter is true, then this method
 * will return the closest location.
 * @returns {module:dloc~DLoc} The data location that corresponds to
 * the location passed. This could be undefined if the location does
 * not correspond to a location in the data tree.
 *
 * @also
 *
 * @param {Node} node A node which, with the next parameter,
 * represents a position.
 * @param {Integer} offset The offset in the node in the first
 * parameter.
 * @param {Boolean} [closest=false] Some GUI locations do not
 * correspond to data locations. Like if the location is in a gui
 * element or phantom text. By default, this method will return
 * undefined in such case. If this parameter is true, then this method
 * will return the closest position.
 * @returns {module:dloc~DLoc} The data location that corresponds to
 * the location passed. This could be undefined if the location does
 * not correspond to a location in the data tree.
 */
Editor.prototype.toDataLocation = function(loc, offset, closest) {
    var node, root;
    if (loc instanceof DLoc) {
        closest = offset;
        offset = loc.offset;
        node = loc.node;
        root = loc.root;
    }
    else
        node = loc;

    if (!closestByClass(node, "_attribute_value", root)) {
        var top_pg;
        var check = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
        while(check) {
            if ((check.classList.contains("_phantom") ||
                 check.classList.contains("_gui"))) {
                // We already know that the caller does not want an
                // approximation.  No point in going on.
                if (!closest)
                    return undefined;
                top_pg = check;
            }

            // Don't go up further than this.
            if (check === this.gui_root)
            break;

            check = check.parentNode;
        }

        if (top_pg) {
            node = top_pg.parentNode;
            offset = indexOf(node.childNodes, top_pg);
        }
    }

    var normalized = this._normalizeCaret(
        makeDLoc(this.gui_root, node, offset));
    node = normalized.node;
    offset = normalized.offset;

    var data_node;
    if (node.nodeType === Node.TEXT_NODE) {
        data_node = this.data_updater.pathToNode(this.nodeToPath(node));
        return makeDLoc(this.data_root, data_node, offset, true);
    }

    if (offset >= node.childNodes.length) {
        data_node = this.data_updater.pathToNode(this.nodeToPath(node));
        return makeDLoc(this.data_root, data_node, data_node.childNodes.length);
    }

    // If pointing to a node that is not a text node or a real element,
    // we must find the previous text node or real element and return a position
    // which points after it.
    var child = node.childNodes[offset];
    if (child.nodeType !== Node.TEXT_NODE &&
        !child.classList.contains("_real")) {
        var prev = child.previousSibling;
        var found;
        while (prev) {
            if (prev.nodeType === Node.TEXT_NODE ||
                prev.classList.contains("_real")) {
                found = prev;
                prev = null;
            }
            else
                prev = prev.previousSibling;
        }

        if (!found)
            return makeDLoc(this.data_root,
                            this.data_updater.pathToNode(this.nodeToPath(node)),
                            0);

        data_node = this.data_updater.pathToNode(this.nodeToPath(found));
        return makeDLoc(this.data_root, data_node.parentNode,
                        indexOf(data_node.parentNode.childNodes,
                                data_node) + 1);
    }

    data_node = this.data_updater.pathToNode(this.nodeToPath(child));
    if (data_node instanceof this.my_window.Attr)
        return makeDLoc(this.data_root, data_node, offset);
    else
        return makeDLoc(this.data_root, data_node.parentNode,
                        indexOf(data_node.parentNode.childNodes, data_node));
};

Editor.prototype.getDataCaret = function (closest) {
    var caret = this.getGUICaret();
    if (caret === undefined)
        return undefined;
    return this.toDataLocation(caret, closest);
};

/**
 * @param {module:dloc~DLoc} loc The location of the data caret.
 * @param {Boolean} [text_edit=false] Whether the caret is being moved
 * for a text editing operation.
 *
 * @also
 *
 * @param {Node} node The location of the data caret.
 * @param {Integer} offset The location of the data caret.
 * @param {Boolean} [text_edit=false] Whether the caret is being moved
 * for a text editing operation.
 */
Editor.prototype.setDataCaret = function (loc, offset, text_edit) {
    if (loc instanceof DLoc)
        text_edit = offset;
    else
        loc = makeDLoc(this.data_root, loc, offset);

    text_edit = !!text_edit; // normalize

    var caret = this.fromDataLocation(loc);
    this._setGUICaret(caret, text_edit ? "text_edit" : undefined);
};


/**
 * @private
 * @param {string} [op] The kind of operation that is triggering this
 * caret change. Can be ``text_edit`` for caret changes due to text
 * editing, ``focus`` for caret changes due to regaining focus, or
 * left undefined for other cases.
 */
Editor.prototype._caretChange = log.wrap(function (op) {
    var text_edit = false;
    var focus = false;

    switch(op) {
    case "text_edit":
        text_edit = true;
        break;
    case "focus":
        focus = true;
        break;
    case undefined:
        break;
    default:
        throw new Error("unexpected value for op: " + op);
    }

    var focus_node;
    var focus_offset;

    var ph;
    var caret = this._sel_focus;
    if (caret) {
        focus_node = caret.node;
        focus_offset = caret.offset;

        if (focus_node.nodeType === Node.ELEMENT_NODE) {
            // Placeholders attract adjacent carets into them.
            ph = domutil.childByClass(focus_node, "_placeholder");
            if (ph && !ph.classList.contains("_dying")) {
                this._setGUICaret(ph, 0, op);
                return;
            }
        }
    }

    // We don't want to do this on regaining focus.
    if (!focus)
        // We want to perform this check before we determine whether the
        // caret really changed position.
        this._setupCompletionMenu();

    // End here if there is no change to the caret.
    if (!(this._old_sel_focus === undefined ||
          this._old_sel_focus.node !== focus_node ||
          this._old_sel_focus.offset !== focus_offset))
        return;

    var old_caret = this._old_sel_focus;
    this._old_sel_focus = caret;

    // Caret movement terminates a text undo, unless the caret is
    // moved by a text edit.
    if (!text_edit)
        this._terminateTextUndo();

    // The class owns_caret can be on more than one element. The
    // classic case is if the caret is at an element label.
    var el;
    while((el = this._caret_owners[0]) !== undefined)
        el.classList.remove("_owns_caret");
    while((el = this._clicked_labels[0]) !== undefined)
        el.classList.remove("_label_clicked");

    if (!caret)
        return;

    if (old_caret) {
        var old_tp = closest(old_caret.node, "._placeholder._transient",
                             old_caret.root);
        if (old_tp && caret.root.contains(old_tp))
            this._gui_updater.removeNode(old_tp);
    }

    // Note that this is not the same as focus_node above!
    var node = (caret.node.nodeType === Node.ELEMENT_NODE)?
        caret.node: caret.node.parentNode;
    var root = caret.root;

    // This caret is no longer in the gui tree. It is probably an
    // intermediary state so don't do anything with it.
    if (!this.gui_root.contains(node))
        return;

    var real = closestByClass(node, "_real", root);
    if (real)
        real.classList.add("_owns_caret");

    var gui = closestByClass(node, "_gui", root);
    // Make sure that the caret is in view.
    if (gui) {
        if (!this._sel_anchor ||
            closestByClass(this._sel_anchor.node, "_gui",
                           root) === gui) {
            var children = domutil.childrenByClass(gui.parentNode,
                                                   "_gui");
            for(var i = 0, child; (child = children[i]) !== undefined;
                ++i)
                child.classList.add("_label_clicked");
        }
    }
    else
        node.classList.add("_owns_caret");

    var fake = this._fake_caret;
    var pos = this._positionFromGUIRoot(fake);
    var $fake = $(fake);
    this.scrollIntoView(pos.left, pos.top,
                        pos.left + $fake.outerWidth(),
                        pos.top + $fake.outerHeight());

    var steps = [];
    while(node !== this.gui_root) {
        if (node.nodeType !== Node.ELEMENT_NODE)
            throw new Error("unexpected node type: " + node.nodeType);

        if (!node.classList.contains("_placeholder") &&
            !closestByClass(node, "_phantom", root)) {
            steps.unshift("<span class='_gui _label'><span>&nbsp;" +
                          util.getOriginalName(node) +
                          "&nbsp;</span></span>");
        }
        node = node.parentNode;
    }
    this._wed_location_bar.innerHTML = steps.length ? steps.join("/") :
        "<span>&nbsp;</span>";
});

Editor.prototype.pushSelection = function () {
    this._selection_stack.push([this._sel_anchor, this._sel_focus]);
    // _clearDOMSelection is to work around a problem in Rangy
    // 1.3alpha.804. See ``tech_notes.rst``.
    if (browsers.MSIE_TO_10)
        this._clearDOMSelection();
};

Editor.prototype.popSelection = function () {
    var it = this._selection_stack.pop();
    this._sel_anchor = it[0];
    this._sel_focus = it[1];
    this._restoreCaretAndSelection(false);
};

/**
 * Restores the caret and selection from the ``this._sel_anchor`` and
 * ``this._sel_focus`` fields. This is used to deal with situations in
 * which the caret and range may have been "damaged" due to browser
 * operations, changes of state, etc.
 *
 * @private
 * @param {boolean} focus Whether the restoration of the caret and
 * selection is due to regaining focus or not.
 */
Editor.prototype._restoreCaretAndSelection = function (focus) {
    if (this._sel_anchor &&
        // It is not impossible that the anchor has been removed
        // after focus was lost so check for it.
        this.gui_root.contains(this._sel_anchor.node)) {
        var rr = this._sel_anchor.makeRange(this._sel_focus);
        this._setDOMSelectionRange(rr.range, rr.reversed);
        this._refreshFakeCaret();
        // We're not selecting anything...
        if (rr.range.collapsed)
            this._focusInputField();
        this._caretChange(focus ? "focus" : undefined);
    }
    else
        this.clearSelection();
};

Editor.prototype.clearSelection = function () {
    this._sel_anchor = undefined;
    this._sel_focus = undefined;
    this._refreshFakeCaret();
    var sel = this._getDOMSelection();
    if (sel.rangeCount > 0 && this.gui_root.contains(sel.focusNode))
        sel.removeAllRanges();
    this._caretChange();
};

Editor.prototype._getDOMSelection = function () {
    return rangy.getSelection(this.my_window);
};

/**
 * @param {boolean} [dont_focus=false] Whether or not we are keeping
 * the focus after clearing the selection. Necessary because in some
 * cases, we are clearing the selection when *losing* focus.
 */
Editor.prototype._clearDOMSelection = function (dont_focus) {
    this._getDOMSelection().removeAllRanges();
    // Make sure the focus goes back there.
    if (!dont_focus)
        this._focusInputField();
};

Editor.prototype._getDOMSelectionRange = function () {
    var range = domutil.getSelectionRange(this.my_window);

    if (!range)
        return undefined;

    // Don't return a range outside our editing framework.
    if (!this.gui_root.contains(range.startContainer) ||
        !this.gui_root.contains(range.endContainer))
        return undefined;

    return range;
};

Editor.prototype.getSelectionRange = function () {
    return this._sel_anchor ? this._sel_anchor.makeRange(this._sel_focus).range
        : undefined;
};

Editor.prototype.setSelectionRange = function (range, reverse) {
    var start = makeDLoc(this.gui_root,
                         range.startContainer, range.startOffset);
    var end = makeDLoc(this.gui_root, range.endContainer, range.endOffset);

    if (reverse) {
        this._sel_anchor = end;
        this._sel_focus = start;
    }
    else {
        this._sel_anchor = start;
        this._sel_focus = end;
    }

    this._setDOMSelectionRange(range, reverse);
    this._refreshFakeCaret();
    this._caretChange();
};

Editor.prototype._normalizeCaretToEditableRange = function (container, offset) {
    if (container instanceof DLoc) {
        if (container.root != this.gui_root)
            throw new Error("DLoc object must be for the GUI tree");
        offset = container.offset;
        container = container.node;
    }

    if(container.nodeType === Node.ELEMENT_NODE) {
        // Normalize to a range within the editable nodes. We could be
        // outside of them in an element which is empty, for instance.
        var pair = this.mode.nodesAroundEditableContents(container);
        var first_index = pair[0] ?
                indexOf(container.childNodes, pair[0]) : -1;
        if (offset <= first_index)
            offset = first_index + 1;
        else {
            var second_index = pair[1] ?
                    indexOf(container.childNodes, pair[1]) :
                    container.childNodes.length;
            if (offset >= second_index)
                offset = second_index;
        }
    }
    return makeDLoc(this.gui_root, container, offset);
};

/**
 * This function is meant to be used internally to manipulate the DOM
 * selection directly. Generally, you want to use {@link
 * module:wed~Editor#setSelectionRange setSelectionRange} instead.
 *
 * @private
 */
Editor.prototype._setDOMSelectionRange = function (range, reverse) {
    if (range.collapsed) {
        this._clearDOMSelection();
        return;
    }

    // The domutil.focusNode call is required to work around bug:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=921444
    if (browsers.FIREFOX)
        domutil.focusNode(range.endContainer);

    // _clearDOMSelection is to work around a problem in Rangy
    // 1.3alpha.804. See ``tech_notes.rst``.
    if (browsers.MSIE_TO_10)
        this._clearDOMSelection();
    var sel = this._getDOMSelection();
    sel.setSingleRange(range, reverse);
};

Editor.prototype.getDataSelectionRange = function () {
    var range = this.getSelectionRange();

    if (range === undefined)
        return undefined;

    var start_caret = this.toDataLocation(range.startContainer,
                                          range.startOffset);
    var end_caret;
    if (!range.collapsed)
        end_caret = this.toDataLocation(range.endContainer, range.endOffset);
    // This will create a collapsed range if end_caret is undefined .
    return start_caret.makeRange(end_caret).range;
};

Editor.prototype.setDataSelectionRange = function (range) {
    var start = this.fromDataLocation(range.startContainer, range.startOffset);
    var end;
    if (!range.collapsed)
        end = this.fromDataLocation(range.endContainer, range.endOffset);
    this.setSelectionRange(start.makeRange(end).range);
};

/**
 * @returns {{left: number, top: number}} The coordinates of the
 * current caret position relative to the screen root.
 */
Editor.prototype._caretPositionOnScreen = function () {
    if (!this._sel_focus)
        return undefined;

    if (this._fake_caret.parentNode)
        return this._fake_caret.getBoundingClientRect();

    var node = this._sel_focus.node;
    if (node.classList &&
        node.classList.contains("_gui"))
        return node.getBoundingClientRect();

    var range = this.getSelectionRange();
    if (range)
        return range.nativeRange.getBoundingClientRect();

    throw new Error("can't find position of caret");
};

});

//  LocalWords:  unclick saveSelection rethrown focusNode setGUICaret ns
//  LocalWords:  caretChangeEmitter caretchange toDataLocation RTL keyup
//  LocalWords:  compositionstart keypress keydown TextUndoGroup Yay
//  LocalWords:  getCaret endContainer startContainer uneditable prev
//  LocalWords:  CapsLock insertIntoText _getDOMSelectionRange prepend
//  LocalWords:  offscreen validthis jshint enterStartTag xmlns xml
//  LocalWords:  namespace mousedown mouseup mousemove compositionend
//  LocalWords:  compositionupdate revalidate tabindex hoc stylesheet
//  LocalWords:  SimpleEventEmitter minified css onbeforeunload Ctrl
//  LocalWords:  Ok contenteditable namespaces errorlist navlist li
//  LocalWords:  ul nav sb href jQuery DOM html mixins onerror gui
//  LocalWords:  wundo domlistener oop domutil util validator
//  LocalWords:  jquery Mangalam MPL Dubeau
