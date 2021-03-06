/**
 * @module domutil
 * @desc Utilities that manipulate or query the DOM tree.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:domutil */ function (require, exports, module) {
"use strict";

var $ = require("jquery");
var rangy = require("rangy");
var util = require("./util");

function indexOf(a, target) {
    var length = a.length;
    for (var i = 0; i < length; ++i) {
        if (a[i] === target) return i;
    }
    return -1;
}

/**
 * Gets the first range in the selection.
 * @param {Window} win The window for which we want the selection.
 * @returns {Range|undefined} The first range in the
 * selection. Undefined if there is no selection or no range.
 */
function getSelectionRange(win) {
    var sel = rangy.getSelection(win);

    if (sel === undefined || sel.rangeCount < 1)
        return undefined;

    return sel.getRangeAt(0);
}

/**
 * Creates a range from two points in a document.
 *
 * @param {Node} startContainer
 * @param {integer} startOffset
 * @param {Node} endContainer
 * @param {integer} endOffset
 * @returns {{range: Range, reversed: boolean}} The <code>range</code>
 * field is a rangy range. The <code>reversed</code> field is
 * <code>true</code> if the range is reversed, that is, if the end
 * comes before the start.
 */
function rangeFromPoints(startContainer, startOffset,
                         endContainer, endOffset) {
    var range = rangy.createRange(startContainer.ownerDocument);
    var reversed = false;
    if (rangy.dom.comparePoints(startContainer, startOffset,
                                endContainer, endOffset) <= 0) {
        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
    }
    else {
        range.setStart(endContainer, endOffset);
        range.setEnd(startContainer, startOffset);
        reversed = true;
    }

    return {range: range, reversed: reversed};
}

/**
 * Focuses the node itself or if the node is a text node, focuses the
 * parent.
 *
 * @param {Node} node Node to focus.
 * @throws {Error} If the node is neither a text node nor an
 * element. Trying to focus something other than these is almost
 * certainly an algorithmic bug.
 */
function focusNode(node) {
    var node_type = node && node.nodeType;
    switch(node_type) {
    case Node.TEXT_NODE:
        node.parentNode.focus();
        break;
    case Node.ELEMENT_NODE:
        node.focus();
        break;
    default:
        throw new Error("tried to focus something other than a text node or " +
                        "an element.");
    }
}

/**
 *
 * <p>This function determines the caret position if the caret was
 * moved forward.</p>
 *
 * <p>This function does not fully emulate how a browser moves the
 * caret. The sole emulation it performs is to check whether
 * whitespace matters or not. It skips whitespace that does not
 * matter.</p>
 *
 * @param {Array} caret A caret position where the search starts. This
 * should be an array of length two that has in first position the
 * node where the caret is and in second position the offset in that
 * node. This pair is to be interpreted in the same way node, offset
 * pairs are interpreted in selection or range objects.
 *
 * @param {Node} container A DOM node which indicates the container
 * within which caret movements must be contained.
 *
 * @param {boolean} no_text If true, and a text node would be
 * returned, the function will instead return the parent of the text
 * node.
 *
 * @returns {Array|null} Returns the next caret position, or null if such
 * position does not exist. The <code>container</code> parameter
 * constrains movements to positions inside it.
 */
function nextCaretPosition(caret, container, no_text) {
    var node = caret[0];
    var offset = caret[1];
    if (no_text === undefined)
        no_text = true;

    var found = false;
    var window = node.ownerDocument.defaultView;
    var parent;
    search_loop:
    while(!found) {
        parent = node.parentNode;
        switch(node.nodeType) {
        case Node.TEXT_NODE:
            if (offset >= node.length ||
                // If the parent node is set to normal whitespace
                // handling, then moving the caret forward by one
                // position will skip this whitespace.
                (parent.lastChild === node &&
                 window.getComputedStyle(parent, null).whiteSpace ===
                 "normal" && /^\s+$/.test(node.data.slice(offset)))) {

                // We would move outside the container
                if (container !== undefined && node === container)
                    break search_loop;

                offset = indexOf(parent.childNodes, node) + 1;
                node = parent;
            }
            else {
                offset++;
                found = true;
            }
            break;
        case Node.ELEMENT_NODE:
            if (offset >= node.childNodes.length) {
                // If we've hit the end of what we can search, stop.
                if (parent === null ||
                    parent === node.ownerDocument ||
                    // We would move outside the container
                    (container !== undefined && node === container))
                    break search_loop;

                offset = indexOf(parent.childNodes, node) + 1;
                node = parent;
                found = true;
            }
            else {
                node = node.childNodes[offset];
                offset = 0;
                if (!(node.childNodes.length > 0 &&
                      node.childNodes[offset].nodeType ===
                      Node.TEXT_NODE))
                    found = true;
            }
            break;
        }
    }

    if (!found)
        return null;

    parent = node.parentNode;
    return (no_text && node.nodeType === Node.TEXT_NODE) ?
        [parent, indexOf(parent.childNodes, node)] : [node, offset];
}

/**
 *
 * <p>This function determines the caret position if the caret was
 * moved backwards.</p>
 *
 * <p>This function does not fully emulate how a browser moves the
 * caret. The sole emulation it performs is to check whether
 * whitespace matters or not. It skips whitespace that does not
 * matter.</p>
 *
 * @param {Array} caret A caret position where the search starts. This
 * should be an array of length two that has in first position the
 * node where the caret is and in second position the offset in that
 * node. This pair is to be interpreted in the same way node, offset
 * pairs are interpreted in selection or range objects.
 *
 * @param {Node} container A DOM node which indicates the container
 * within which caret movements must be contained.
 *
 * @param {boolean} no_text If true, and a text node would be
 * returned, the function will instead return the parent of the text
 * node.
 *
 * @returns {Array} Returns the previous caret position, or null if
 * such position does not exist.
 */
function prevCaretPosition(caret, container, no_text) {
    var node = caret[0];
    var offset = caret[1];
    if (no_text === undefined)
        no_text = true;

    var found = false;
    var parent;
    search_loop:
    while(!found) {
        offset--;
        parent = node.parentNode;
        switch(node.nodeType) {
        case Node.TEXT_NODE:
            if (offset < 0 ||
                // If the parent node is set to normal whitespace
                // handling, then moving the caret back by one
                // position will skip this whitespace.
                (parent.firstChild === node &&
                 window.getComputedStyle(parent, null).whiteSpace ===
                 "normal" && /^\s+$/.test(node.data.slice(0, offset)))) {

                // We would move outside the container
                if (container !== undefined && node === container)
                    break search_loop;

                offset = indexOf(parent.childNodes, node);
                node = parent;
            }
            else
                found = true;
            break;
        case Node.ELEMENT_NODE:
            if (offset < 0 || node.childNodes.length === 0) {
                // If we've hit the end of what we can search, stop.
                if (parent === null ||
                    parent === node.ownerDocument ||
                    // We would move outside the container
                    (container !== undefined && node === container))
                    break search_loop;

                offset = indexOf(parent.childNodes, node);
                node = parent;
                found = true;
            }
            // If node.childNodes.length === 0, the first branch would
            // have been taken. No need to test that offset indexes to
            // something that exists.
            else {
                node = node.childNodes[offset];
                if (node.nodeType === Node.ELEMENT_NODE) {
                    offset = node.childNodes.length;
                    if (!(node.childNodes.length > 0 &&
                          node.childNodes[offset - 1].nodeType ===
                          Node.TEXT_NODE))
                        found = true;
                }
                else
                    offset = node.length + 1;
            }
            break;
        }
    }

    if (!found)
        return null;

    parent = node.parentNode;
    return (no_text && node.nodeType === Node.TEXT_NODE) ?
        [parent, indexOf(parent.childNodes, node)] : [node, offset];
}

/**
 * Given two trees A and B of DOM nodes, this function finds the node
 * in tree B which corresponds to a node in tree A. The two trees must
 * be structurally identical. If tree B is cloned from tree A, it will
 * satisfy this requirement. This function does not work with
 * attribute nodes.
 *
 * @param {Node} tree_a The root of the first tree.
 * @param {Node} tree_b The root of the second tree.
 * @param {Node} node_in_a A node in the first tree.
 * @returns {Node} The node which corresponds to ``node_in_a`` in
 * ``tree_b``.
 * @throws {Error} If ``node_in_a`` is not ``tree_a`` or a child of ``tree_a``.
 */
function correspondingNode(tree_a, tree_b, node_in_a) {
    var path = [];
    var current = node_in_a;
    while(current !== tree_a) {
        var parent = current.parentNode;
        if (!parent)
            throw new Error("node_in_a is not tree_a or a child of tree_a");
        path.unshift(indexOf(parent.childNodes, current));
        current = parent;
    }

    var ret = tree_b;
    while(path.length)
        ret = ret.childNodes[path.shift()];

    return ret;
}

/**
 * Makes a placeholder element
 *
 * @param {string} text The text to put in the placeholder.
 * @returns {Node} A node.
 */
function makePlaceholder(text) {
    var span = document.createElement("span");
    span.className = "_placeholder";
    span.setAttribute("contenteditable", "true");
    span.innerHTML = text || " ";
    return span;
}

/**
 * Splits a text node into two nodes. This function takes care to
 * modify the DOM tree only once.
 *
 * @param {Node} text_node The text node to split into two text nodes.
 * @param {integer} index The offset into the text node where to split.
 * @returns {Array.<Node>} The first element of the array is the text
 * node which contains the text before index and the second element
 * of the array is the text node which contains the text after the
 * index.
 */
function splitTextNode(text_node, index) {
    var carets = _insertIntoText(text_node, index, undefined, false);
    return [carets[0][0], carets[1][0]];
}


/**
 * <p>Inserts an element into text, effectively splitting the text node in
 * two. This function takes care to modify the DOM tree only once.</p>
 *
 * <p>This function must have <code>this</code> set to an object that
 * has the <code>insertNodeAt</code> and <code>deleteNode</code> set
 * to functions with the signatures of {@link
 * module:domutil~insertNodeAt insertNodeAt} and {@link
 * module:domutil~mergeTextNodes mergeTextNodes}. It optionally can
 * have a <code>insertFragAt</code> function with the same signature
 * as <code>insertNodeAt</code>.</p>
 *
 * @param {Node} text_node The text node that will be cut in two by the new
 * element.
 * @param {integer} index The offset into the text node where
 * the new element is to be inserted.
 * @param {Node} node The node to insert.
 * @returns {Array} The first element of the array is a caret position
 * (i.e. a pair of container and offset) marking the boundary between
 * what comes before the material inserted and the material
 * inserted. The second element of the array is a caret position
 * marking the boundary between the material inserted and what comes
 * after. If I insert "foo" at position 2 in "abcd", then the final
 * result would be "abfoocd" and the first caret would mark the
 * boundary between "ab" and "foo" and the second caret the boundary
 * between "foo" and "cd".
 * @throws {Error} If the node to insert is undefined or null.
 */
function genericInsertIntoText(text_node, index, node) {
    // This function is meant to be called with this set to a proper
    // value.
    /* jshint validthis:true */
    if (!node)
        throw new Error("must pass an actual node to insert");
    return _genericInsertIntoText.apply(this, arguments);
}

/**
 * Inserts an element into text, effectively splitting the text node in
 * two. This function takes care to modify the DOM tree only once.
 *
 * <p>This function must have <code>this</code> set to an object that
 * has the <code>insertNodeAt</code> and <code>deleteNode</code> set
 * to functions with the signatures of {@link
 * module:domutil~insertNodeAt insertNodeAt} and {@link
 * module:domutil~mergeTextNodes mergeTextNodes}. It optionally can
 * have an <code>insertFragAt</code> function with the same signature
 * as <code>insertNodeAt</code>.</p>
 *
 * @private
 * @param {Node} text_node The text node that will be cut in two by the new
 * element.
 * @param {integer} index The offset into the text node where
 * the new element is to be inserted.
 * @param {Node} node The node to insert. If this parameter evaluates
 * to <code>false</code>, then this function effectively splits the
 * text node into two parts.
 * @param {boolean} [clean=true] The operation must clean contiguous
 * text nodes so as to merge them and must not create empty
 * nodes. <strong>This code assumes that the text node into which data
 * is added is not preceded or followed by another text node and that
 * it is not empty.</strong> In other words, if the DOM tree on which
 * this code is used does not have consecutive text nodes and no empty
 * nodes, then after the call, it still won't.
 * @returns {Array} The first element of the array is a caret position
 * (i.e. a pair of container and offset) marking the boundary between
 * what comes before the material inserted and the material
 * inserted. The second element of the array is a caret position
 * marking the boundary between the material inserted and what comes
 * after. If I insert "foo" at position 2 in "abcd", then the final
 * result would be "abfoocd" and the first caret would mark the
 * boundary between "ab" and "foo" and the second caret the boundary
 * between "foo" and "cd".
 * @throws {Error} If <code>text_node</code> is not a text node.
 */
function _genericInsertIntoText(text_node, index, node, clean) {
    // This function is meant to be called with this set to a proper
    // value.
    /* jshint validthis:true */
    if (text_node.nodeType !== Node.TEXT_NODE)
        throw new Error("insertIntoText called on non-text");

    var start_caret;
    var end_caret;

    if (clean === undefined)
        clean = true;

    // Normalize
    if (index < 0)
        index = 0;
    else if (index > text_node.length)
        index = text_node.length;

    var search_node, prev, next;
    var is_fragment = node && (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE);

    var parent = text_node.parentNode;
    var text_node_at = indexOf(parent.childNodes, text_node);
    if (clean && (!node || (is_fragment && node.childNodes.length === 0)))
    {
        start_caret = end_caret = [text_node, index];
    }
    else {
        var frag = document.createDocumentFragment();
        prev = document.createTextNode(text_node.data.slice(0, index));
        frag.appendChild(prev);
        if (node)
            frag.appendChild(node);
        next = document.createTextNode(text_node.data.slice(index));
        var next_len = next.length;
        frag.appendChild(next);

        if (clean)
            frag.normalize();

        if (clean && index === 0)
            start_caret = [parent, text_node_at];
        else
            start_caret = [frag.firstChild, index];

        if (clean && index === text_node.length)
            end_caret = [parent, text_node_at + frag.childNodes.length];
        else
            end_caret = [frag.lastChild, frag.lastChild.length -  next_len];

        this.deleteNode(text_node);
        if (this.insertFragAt)
            this.insertFragAt(parent, text_node_at, frag);
        else
            while (frag.firstChild)
                this.insertNodeAt(parent, text_node_at++, frag.firstChild);
    }
    return [start_caret, end_caret];
}

var plain_dom_mockup =     {
    insertNodeAt: insertNodeAt,
    insertFragAt: insertNodeAt,
    deleteNode: deleteNode
};

/**
 * See {@link module:domutil~_genericInsertIntoText _genericInsertIntoText}.
 *
 * @function
 * @private
 */
var _insertIntoText = _genericInsertIntoText.bind(plain_dom_mockup);

/**
 * Inserts an element into text, effectively splitting the text node in
 * two. This function takes care to modify the DOM tree only once.
 * @function
 * @param {Node} text_node The text node that will be cut in two by the new
 * element.
 * @param {integer} index The offset into the text node where
 * the new element is to be inserted.
 * @param {Node} node The node to insert.
 * @returns {Array} The first element of the array is a caret position
 * (i.e. a pair of container and offset) marking the boundary between
 * what comes before the material inserted and the material
 * inserted. The second element of the array is a caret position
 * marking the boundary between the material inserted and what comes
 * after. If I insert "foo" at position 2 in "abcd", then the final
 * result would be "abfoocd" and the first caret would mark the
 * boundary between "ab" and "foo" and the second caret the boundary
 * between "foo" and "cd".
 */
var insertIntoText = genericInsertIntoText.bind(plain_dom_mockup);

/**
 * Inserts text into a node. This function will use already existing
 * text nodes whenever possible rather than create a new text node.
 *
 * @param {Node} node The node where the text is to be inserted.
 * @param {integer} index The location in the node where the text is
 * to be inserted.
 * @param {string} text The text to insert.
 * @returns {Array.<Node>} The first element of the array is the node
 * that was modified to insert the text. It will be
 * <code>undefined</code> if no node was modified. The second element
 * is the text node which contains the new text. The two elements are
 * defined and equal if a text node was modified to contain the newly
 * inserted text. They are unequal if a new text node had to be
 * created to contain the new text. A return value of
 * <code>[undefined, undefined]</code> means that no modification
 * occurred (because the text passed was "").
 * @throws {Error} If <code>node</code> is not an element or text Node type.
 */
function genericInsertText(node, index, text) {
    // This function is meant to be called with this set to a proper
    // value.
    /* jshint validthis:true */
    if (text === "")
        return [undefined, undefined];

    var text_node;
    work:
    while (true) {
        switch(node.nodeType) {
        case Node.ELEMENT_NODE:
            var child = node.childNodes[index];
            if (child && child.nodeType === Node.TEXT_NODE) {
                // Prepend to already existing text node.
                node = child;
                index = 0;
                continue work;
            }

            var prev = node.childNodes[index - 1];
            if (prev && prev.nodeType === Node.TEXT_NODE) {
                // Append to already existing text node.
                node = prev;
                index = node.length;
                continue work;
            }

            // We have to create a text node
            text_node = document.createTextNode(text);
            this.insertNodeAt(node, index, text_node);
            node = undefined;
            break work;
        case Node.TEXT_NODE:
            var pre = node.data.slice(0, index);
            var post = node.data.slice(index);
            this.setTextNodeValue(node, pre + text + post);
            text_node = node;
            break work;
        default:
            throw new Error("unexpected node type: " + node.nodeType);
        }
    }
    return [node, text_node];
}

/**
 * Inserts text into a node. This function will use already existing
 * text nodes whenever possible rather than create a new text node.
 * @function
 * @param {Node} node The node where the text is to be inserted.
 * @param {integer} index The location in the node where the text is
 * to be inserted.
 * @param {string} text The text to insert.
 * @returns {Array.<Node>} The first element of the array is the node
 * that was modified to insert the text. It will be
 * <code>undefined</code> if no node was modified. The second element
 * is the text node which contains the new text. The two elements are
 * defined and equal if a text node was modified to contain the newly
 * inserted text. They are unequal if a new text node had to be
 * created to contain the new text. A return value of
 * <code>[undefined, undefined]</code> means that no modification
 * occurred (because the text passed was "").
 * @throws {Error} If <code>node</code> is not an element or text Node type.
 */
var insertText = genericInsertText.bind({
    insertNodeAt: insertNodeAt,
    setTextNodeValue: function (node, value) {
        node.data = value;
    }
});

/**
 * Deletes text from a text node. If the text node becomes empty, it
 * is deleted.
 *
 * @param {Node} node The text node from which to delete text.
 * @param {integer} index The index at which to delete text.
 * @param {integer} length The length of text to delete.
 * @throws {Error} If <code>node</code> is not a text Node type.
 */
function deleteText(node, index, length) {
    if (node.nodeType === Node.TEXT_NODE) {
        node.deleteData(index, length);
        if (!node.length)
            node.parentNode.removeChild(node);
    }
    else
        throw new Error("deleteText called on non-text");
}

/**
 * This function recursively links two DOM trees through the jQuery
 * <code>.data()</code> method. For an element in the first tree the data
 * item named "wed_mirror_node" points to the corresponding element
 * in the second tree, and vice-versa. It is presumed that the two
 * DOM trees are perfect mirrors of each other, although no test is
 * performed to confirm this.
 *
 * @param {Node} root_a A DOM node.
 * @param {Node} root_b A second DOM node.
 *
 */
function linkTrees(root_a, root_b) {
    $.data(root_a, "wed_mirror_node", root_b);
    $.data(root_b, "wed_mirror_node", root_a);
    if (root_a.nodeType === Node.ELEMENT_NODE) {
        for(var i = 0; i < root_a.childNodes.length; ++i) {
            var child_a = root_a.childNodes[i];
            var child_b = root_b.childNodes[i];
            linkTrees(child_a, child_b);
        }
    }
}

/**
 * This function recursively unlinks a DOM tree though the jQuery
 * <code>.data()</code> method.
 *
 * @param {Node} root A DOM node.
 *
 */
function unlinkTree(root) {
    $.removeData(root, "wed_mirror_node");
    if (root.nodeType === Node.ELEMENT_NODE)
        for(var i = 0; i < root.childNodes.length; ++i)
            unlinkTree(root.childNodes[i]);
}


/**
 * <p>Returns the first descendant or the node passed to the function
 * if the node happens to not have a descendant. The descendant returned
 * is the deepest one which is first in its parent.</p>
 *
 * <p>When passed
 * <code>&lt;p>&lt;b>A&lt;/b>&lt;b>&lt;q>B&lt;/q>&lt;/b>&lt;/p></code>
 * this code would return the text node "A" because it has no children
 * and is first.</p>
 *
 * @param {Node} node The node to search.
 * @returns {Node} The first node which is both first in its parent
 * and has no children.
 */
function firstDescendantOrSelf(node) {
    while (node && node.childNodes && node.childNodes.length)
        node = node.firstChild;
    return node;
}

/**
 * Removes the node. Mainly for use with the generic functions defined here.
 *
 * @param {Node} node The node to remove.
 */
function deleteNode(node) {
    node.parentNode.removeChild(node);
}

/**
 * Inserts a node at the position specified. Mainly for use with the
 * generic functions defined here.
 *
 * @param {Node} parent The node which will become the parent of the
 * inserted node.
 * @param {integer} index The position at which to insert the node
 * into the parent.
 * @param {Node} node The node to insert.
 */
function insertNodeAt(parent, index, node) {
    parent.insertBefore(node, parent.childNodes[index] || null);
}

/**
 * Merges a text node with the next text node, if present. When called
 * on something which is not a text node or if the next node is not
 * text, does nothing. Mainly for use with the generic functions defined here.
 *
 * @param {Node} node The node to merge with the next node.
 * @returns {Array} A two-element array. It is a caret position
 * between the two parts that were merged, or between the two nodes
 * that were not merged (because they were not both text).
*/
function mergeTextNodes(node) {
    var next = node.nextSibling;
    if (node.nodeType === Node.TEXT_NODE &&
        next && next.nodeType === Node.TEXT_NODE) {
        var offset = node.length;
        node.appendData(next.data);
        next.parentNode.removeChild(next);
        return [node, offset];
    }

    var parent = node.parentNode;
    return [parent, indexOf(parent.childNodes, node) + 1];
}

/**
 * <p>Removes the contents between the start and end carets from the DOM
 * tree. If two text nodes become adjacent, they are merged.</p>
 *
 * <p>This function must have <code>this</code> set to an object that
 * has the <code>deleteText</code>, <code>deleteNode</code> and
 * <code>mergeTextNodes</code> symbols set to functions with the
 * signatures of {@link module:domutil~deleteText deleteText}, {@link
 * module:domutil~deleteNode deleteNode} and {@link
 * module:domutil~mergeTextNodes mergeTextNodes}.
 *
 * @param {Array} start_caret Start caret position.
 * @param {Array} end_caret Ending caret position.
 * @returns {Array} A pair of items. The first item is the caret
 * position indicating where the cut happened. The second item is a
 * list of nodes, the cut contents.
 * @throws {Error} If Nodes in the range are not in the same element.
 */
function genericCutFunction (start_caret, end_caret) {
    if (!isWellFormedRange({startContainer: start_caret[0],
                            startOffset: start_caret[1],
                            endContainer: end_caret[0],
                            endOffset: end_caret[1]}))
        throw new Error("range is not well-formed");

    // This function is meant to be called with this set to a proper
    // value.
    /* jshint validthis:true */
    var start_container = start_caret[0];
    var start_offset = start_caret[1];
    var end_container = end_caret[0];
    var end_offset = end_caret[1];

    var parent = start_container.parentNode;
    var final_caret;
    var start_text;

    if (start_container.nodeType === Node.TEXT_NODE &&
        start_offset === 0) {
        // We are at the start of a text node, move up to the parent.
        start_offset = indexOf(parent.childNodes, start_container);
        start_container = parent;
        parent = start_container.parent;
    }

    if (start_container.nodeType === Node.TEXT_NODE) {
        var same_container = start_container === end_container;

        var start_container_offset = indexOf(
            parent.childNodes, start_container);

        var end_text_offset = same_container ? end_offset :
                start_container.length;

        start_text = parent.ownerDocument.createTextNode(
            start_container.data.slice(start_offset, end_text_offset));
        this.deleteText(start_container, start_offset, start_text.length);

        final_caret = (start_container.parentNode) ?
            [start_container, start_offset] :
            // Selection was such that the text node was emptied.
            [parent, start_container_offset];

        if (same_container)
            // Both the start and end were in the same node, so the
            // deleteText operation above did everything needed.
            return [final_caret, [start_text]];

        // Alter our start to take care of the rest
        start_offset = (start_container.parentNode) ?
            // Look after the text node we just modified.
            start_container_offset + 1 :
            // Selection was such that the text node was emptied, and
            // thus removed. So stay at the same place.
            start_container_offset;
        start_container = parent;
    }
    else
        final_caret = [start_container, start_offset];

    var end_text;
    if (end_container.nodeType === Node.TEXT_NODE) {
        parent = end_container.parentNode;
        var end_container_offset = indexOf(
            parent.childNodes, end_container);

        end_text = parent.ownerDocument.createTextNode(
            end_container.data.slice(0, end_offset));
        this.deleteText(end_container, 0, end_offset);

        // Alter our end to take care of the rest
        end_offset = end_container_offset;
        end_container = parent;
    }

    // At this point, the following checks must hold
    if (start_container !== end_container)
            throw new Error("internal error in cut: containers unequal");
    if (start_container.nodeType !== Node.ELEMENT_NODE)
        throw new Error("internal error in cut: not an element");

    var return_nodes = [];
    end_offset--;
    // Doing it in reverse allows us to not worry about offsets
    // getting out of whack.
    while (end_offset >= start_offset) {
        return_nodes.unshift(end_container.childNodes[end_offset]);
        this.deleteNode(end_container.childNodes[end_offset]);
        end_offset--;
    }
    if (start_text)
        return_nodes.unshift(start_text);
    if (end_text)
        return_nodes.push(end_text);

    // At this point, end_offset points to the node that is before the
    // list of nodes removed.
    if (end_container.childNodes[end_offset])
        this.mergeTextNodes(end_container.childNodes[end_offset]);
    return [final_caret, return_nodes];
}

/**
 * Returns the <strong>element</strong> nodes that contain the start
 * and the end of the range. If an end of the range happens to be in a
 * text node, the element node will be that node's parent.
 *
 * @private
 * @param {Object} range An object which has the
 * <code>startContainer</code>, <code>startOffset</code>,
 * <code>endContainer</code>, <code>endOffset</code> attributes
 * set. The interpretation of these values is the same as for DOM
 * <code>Range</code> objects. Therefore, the object passed can be a
 * DOM range.
 * @returns {Array} A pair of nodes.
 * @throws {Error} If a node in <code>range</code> is not of element
 * or text Node types.
 */
function nodePairFromRange(range) {
    var start_node;
    switch(range.startContainer.nodeType) {
    case Node.TEXT_NODE:
        start_node = range.startContainer.parentNode;
        break;
    case Node.ELEMENT_NODE:
        start_node = range.startContainer;
        break;
    default:
        throw new Error("unexpected node type: " +
                        range.startContainer.nodeType);

    }

    var end_node;
    switch(range.endContainer.nodeType) {
    case Node.TEXT_NODE:
        end_node = range.endContainer.parentNode;
        break;
    case Node.ELEMENT_NODE:
        end_node = range.endContainer;
        break;
    default:
        throw new Error("unexpected node type: " + range.endContainer.nodeType);
    }
    return [start_node, end_node];
}

/**
 * Determines whether a range is well-formed. A well-formed range is
 * one which starts and ends in the same element.
 *
 * @param {Object} range An object which has the
 * <code>startContainer</code>, <code>startOffset</code>,
 * <code>endContainer</code>, <code>endOffset</code> attributes
 * set. The interpretation of these values is the same as for DOM
 * <code>Range</code> objects. Therefore, the object passed can be a
 * DOM range.
 * @returns {boolean} <code>true</code> if the range is well-formed.
 * <code>false</code> if not.
 */
function isWellFormedRange(range) {
    var pair = nodePairFromRange(range);
    return pair[0] === pair[1];
}

/**
 * Dumps the current selection to the console.
 *
 * @param {string} msg A message to output in front of the range
 * information.
 * @param {Window} win The window for which to dump selection
 * information.
 */
function dumpCurrentSelection(msg, win) {
    dumpRange(msg, getSelectionRange(win));
}


/**
 * Dumps a range to the console.
 *
 * @param {string} msg A message to output in front of the range
 * information.
 * @param {Window} range The range.
 */
function dumpRange(msg, range) {
    if (!range)
        console.log(msg, "no range");
    else
        console.log(msg,
                    range.startContainer,
                    range.startOffset,
                    range.endContainer,
                    range.endOffset);
}


/**
 * Dumps a range to a string.
 *
 * @param {string} msg A message to output in front of the range
 * information.
 * @param {Window} range The range.
 */
function dumpRangeToString(msg, range) {
    var ret;
    if (!range)
        ret = [msg, "no range"];
    else
        ret = [msg,
               range.startContainer.outerHTML,
               range.startOffset,
               range.endContainer.outerHTML,
               range.endOffset];
    return ret.join(", ");
}


/**
 * Checks whether a point is in the element's contents. This means
 * inside the element and <strong>not</strong> inside one of the
 * scrollbars that the element may have. The coordinates passed must
 * be <strong>relative to the document.</strong> If the coordinates
 * are taken from an event, this means passing <code>pageX</code> and
 * <code>pageY</code>.
 *
 * @param {Node} element The element to check.
 * @param {number} x The x coordinate <strong>relative to the
 * document.</strong>
 * @param {number} y The y coordinate <strong>relative to the
 * document.</strong>
 * @returns {boolean} <code>true</code> if inside, <code>false</code>
 * if not.
 */
function pointInContents(element, x, y) {
    // Convert the coordinates relative to the document to coordinates
    // relative to the element.
    var body = element.ownerDocument.body;
    // Using clientLeft and clientTop is not equivalent to using the rect.
    var rect = element.getBoundingClientRect();
    x -= rect.left + body.scrollLeft;
    y -= rect.top + body.scrollTop;

    return ((x >= 0) && (y >= 0) &&
            (x < element.clientWidth) && (y < element.clientHeight));
}

/**
 * Starting with the element passed, and walking up the element's
 * parents, returns the first element that matches the selector.
 *
 * @param {Element} node The element to start with.
 * @param {string} selector The selector to use for matches.
 * @param {Element} [limit] An optional limit. The algorithm will
 * search up to this limit, inclusively.
 * @returns {Element|null} The first element that matches the
 * selector, or ``null`` if nothing matches.
 */
function closest(node, selector, limit) {

    if (node === undefined || node === null)
        return null;

    // Immediately move out of text nodes.
    if (node.nodeType === Node.TEXT_NODE)
        node = node.parentNode;

    while(node) {
        if (node.nodeType !== Node.ELEMENT_NODE)
            return null;

        if (node.matches(selector))
            break;

        if (node === limit) {
            node = null;
            break;
        }

        node = node.parentNode;

    }
    return node;
}

/**
 * Starting with the element passed, and walking up the elements's
 * parents, returns the first element that matches the class.
 *
 * @param {Element} node The element to start with.
 * @param {string} cl The class to use for matches.
 * @param {Element} [limit] An optional limit. The algorithm will
 * search up to this limit, inclusively.
 * @returns {Element|null} The first element that matches the
 * class, or ``null`` if nothing matches.
 */
function closestByClass(node, cl, limit) {

    if (node === undefined || node === null)
        return null;

    // Immediately move out of text nodes.
    if (node.nodeType === Node.TEXT_NODE)
        node = node.parentNode;

    while(node) {
        if (node.nodeType !== Node.ELEMENT_NODE)
            return null;

        if (node.classList.contains(cl))
            break;

        if (node === limit) {
            node = null;
            break;
        }

        node = node.parentNode;

    }
    return node;
}

/**
 * Find a sibling matching the class.
 *
 * @param {Element} node The element whose sibling we are looking for.
 * @param {string} cl The class to use for matches.
 * @returns {Element|null} The first sibling (in document order) that
 * matches the class, or ``null`` if nothing matches.
 */
function siblingByClass(node, cl) {

    if (node === undefined || node === null ||
        node.nodeType !== Node.ELEMENT_NODE)
        return null;

    var parent = node.parentNode;
    if (!parent)
        return null;

    var child = parent.firstElementChild;
    while(child && !child.classList.contains(cl))
        child = child.nextElementSibling;
    return child;
}

/**
 * Find children matching the class.
 *
 * @param {Element} node The element whose children we are looking for.
 * @param {string} cl The class to use for matches.
 * @returns {Array.<Element>} The children (in document order) that
 * match the class.
 */
function childrenByClass(node, cl) {

    if (node === undefined || node === null ||
        node.nodeType !== Node.ELEMENT_NODE)
        return [];

    var ret = [];
    var child = node.firstElementChild;
    while (child) {
        if (child.classList.contains(cl))
            ret.push(child);
        child = child.nextElementSibling;
    }

    return ret;
}

/**
 * Find child matching the class.
 *
 * @param {Element} node The element whose child we are looking for.
 * @param {string} cl The class to use for matches.
 * @returns {Element|null} The first child (in document order) that
 * matches the class, or ``null`` if nothing matches.
 */
function childByClass(node, cl) {
    if (node === undefined || node === null ||
        node.nodeType !== Node.ELEMENT_NODE)
        return null;

    var child = node.firstElementChild;
    while (child && !child.classList.contains(cl))
        child = child.nextElementSibling;
    return child;
}

var textToHTML_span;

/**
 * Convert a string to HTML encoding. For instance if you want to have
 * the less-than symbol be part of the contents of a ``span`` element,
 * it would have to be escaped to ``<`` otherwise it would be
 * interpreted as the beginning of a tag. This function does this kind
 * of escaping.
 *
 * @param {string} text The text to convert.
 * @returns {string} The converted text.
 */
function textToHTML(text) {
    if (!textToHTML_span)
        textToHTML_span = document.createElement("span");
    textToHTML_span.textContent = text;
    return textToHTML_span.innerHTML;
}

var separators = ",>+~ ";
var separator_re = new RegExp("([" + separators + "]+)");

/**
 * Converts a CSS selector written as if it were run against the XML
 * document being edited by wed into a selector that will match the
 * corresponding items in the GUI tree. This implementation is
 * extremely naive and likely to break on complex selectors. Some
 * specific things it cannot do:
 *
 * - Match attributes.
 *
 * - Match pseudo-elements.
 *
 * @param {string} selector The selector to convert.
 * @returns {string} The converted selector.
 */
function toGUISelector(selector) {
    if (/[\]['"()]/.test(selector))
        throw new Error("selector is too complex");

    var parts = selector.split(separator_re);
    var ret = [];
    for(var i = 0; i < parts.length; ++i) {
        var part = parts[i];
        if (part.length) {
            if (separators.indexOf(part) > -1)
                ret.push(part);
            else if (/[a-zA-Z]/.test(part[0])) {
                part = part.trim();
                var name_split = part.split(/(.#)/);
                ret.push(util.classFromOriginalName(name_split[0]));
                ret = ret.concat(name_split.slice(1));
            }
            else
                ret.push(part);
        }
    }
    return ret.join("");
}

/**
 * Allows applying simple CSS selectors on the data tree as if it were
 * an HTML tree. This is necessary because the current browsers are
 * unable to handle tag prefixes or namespaces in selectors passed to
 * ``matches``, ``querySelector`` and related functions.
 *
 * The steps are:
 *
 * 1. Convert ``selector`` with {@link module:domutil~toGUISelector
 * toGUISelector} into a selector that can be applied to the GUI tree.
 *
 * 2. Convert ``node`` to a GUI node.
 *
 * 3. Apply the converted selector to the GUI node.
 *
 * 4. Convert the resulting node to a data node.
 *
 * @param {Node} node The data node to use as the starting point of
 * the query.
 * @param {string} selector The selector to use.
 * @returns {Node} The resulting data node.
 */
function dataFind(node, selector) {
    var gui_selector = toGUISelector(selector);
    var gui_node = $.data(node, "wed_mirror_node");
    var found_node = gui_node.querySelector(gui_selector);
    return $.data(found_node, "wed_mirror_node");
}

/**
 * Allows applying simple CSS selectors on the data tree as if it were
 * an HTML tree. Operates like {@link module:domutil~dataFind
 * dataFind} but returns an array of nodes.
 *
 * @param {Node} node The data node to use as the starting point of
 * the query.
 * @param {string} selector The selector to use.
 * @returns {Array.<Node>} The resulting data nodes.
 */
function dataFindAll(node, selector) {
    var gui_selector = toGUISelector(selector);
    var gui_node = $.data(node, "wed_mirror_node");
    var found_nodes = gui_node.querySelectorAll(gui_selector);
    var ret = [];
    for(var i = 0, found_node; (found_node = found_nodes[i]); ++i)
        ret.push($.data(found_node, "wed_mirror_node"));
    return ret;
}

/**
 * Converts an HTML string to an array of DOM nodes
 * @param {string} html The HTML to convert.
 * @param {Document} [document] The document for which to create the
 * nodes. If not specified, the document will be the global ``document``.
 * @returns {Array.<Node>} The resulting nodes.
 */
function htmlToElements(html, document) {
    var doc = document || window.document;
    var frag = doc.createDocumentFragment();
    var div = doc.createElement("div");
    frag.appendChild(div);
    div.innerHTML = html;
    return Array.prototype.slice.call(div.childNodes);
}

/**
 * Gets the character immediately before the caret. The word
 * "immediately" here means that this function does not walk the
 * DOM. If the caret is pointing into an element node, it will check
 * whether the node before the offset is a text node and use
 * it. That's the extent to which it walks the DOM.
 *
 * @param {Array} caret The caret position.
 * @return {string|undefined} The character, if it exists.
 */
function getCharacterImmediatelyBefore(caret) {
    var node = caret[0];
    var offset = caret[1];
    switch(node.nodeType) {
    case Node.TEXT_NODE:
        var value = node.data;
        return value[offset - 1];
    case Node.ELEMENT_NODE:
        var prev = node[offset - 1];
        if (prev && prev.nodeType === Node.TEXT_NODE)
            return prev.value[prev.value - 1];
        break;
    default:
        throw new Error("unexpected node type: " + node.nodeType);
    }
    return undefined;
}

/**
 * Gets the character immediately at the caret. The word "immediately"
 * here means that this function does not walk the DOM. If the caret
 * is pointing into an element node, it will check whether the node
 * after the offset is a text node and use it. That's the extent to
 * which it walks the DOM.
 *
 * @param {Array} caret The caret position.
 * @return {string|undefined} The character, if it exists.
 */
function getCharacterImmediatelyAt(caret) {
    var node = caret[0];
    var offset = caret[1];
    switch(node.nodeType) {
    case Node.TEXT_NODE:
        var value = node.data;
        return value[offset];
    case Node.ELEMENT_NODE:
        var next = node[offset];
        if (next && next.nodeType === Node.TEXT_NODE)
            return next.value[0];
        break;
    default:
        throw new Error("unexpected node type: " + node.nodeType);
    }
    return undefined;
}

/**
 * Determine whether an element is displayed. This function is
 * designed to handle checks in wed's GUI tree, and not as a general
 * purpose solution. It only checks whether the element or its parents
 * have ``display`` set to ``"none"``.
 *
 * @param {Element} el The DOM element for which we want to check
 * whether it is displayed or not.
 * @param {Element} root The parent of ``el`` beyond which we do not
 * search.
 * @returns {boolean} ``true`` if the element or any of its parents is
 * not displayed. ``false`` otherwise. If the search up the DOM tree
 * hits ``root``, then the value returned is ``false``.
 */
function isNotDisplayed(el, root) {
    var win = el.ownerDocument.defaultView;

    // We don't put put a menu for attributes that are somehow not
    // displayed.
    while (el && el !== root) {
        if (el.style.display === "none")
            return true;

        var display = win.getComputedStyle(el)
                .getPropertyValue("display");

        if (display === "none")
            return true;

        el = el.parentNode;
    }

    return false;
}

exports.getSelectionRange = getSelectionRange;
exports.nextCaretPosition = nextCaretPosition;
exports.prevCaretPosition = prevCaretPosition;
exports.makePlaceholder = makePlaceholder;
exports.splitTextNode = splitTextNode;
exports.insertIntoText = insertIntoText;
exports.insertText = insertText;
exports.deleteText = deleteText;
exports.linkTrees = linkTrees;
exports.unlinkTree = unlinkTree;
exports.firstDescendantOrSelf = firstDescendantOrSelf;
exports.isWellFormedRange = isWellFormedRange;
exports.genericCutFunction = genericCutFunction;
exports.genericInsertIntoText = genericInsertIntoText;
exports.genericInsertText = genericInsertText;
exports.deleteNode = deleteNode;
exports.mergeTextNodes = mergeTextNodes;
exports.rangeFromPoints = rangeFromPoints;
exports.focusNode = focusNode;
exports.dumpCurrentSelection = dumpCurrentSelection;
exports.dumpRange = dumpRange;
exports.dumpRangeToString = dumpRangeToString;
exports.pointInContents = pointInContents;
exports.correspondingNode = correspondingNode;
exports.closest = closest;
exports.closestByClass = closestByClass;
exports.siblingByClass = siblingByClass;
exports.childrenByClass = childrenByClass;
exports.childByClass = childByClass;
exports.textToHTML = textToHTML;
exports.toGUISelector = toGUISelector;
exports.dataFind = dataFind;
exports.dataFindAll = dataFindAll;
exports.htmlToElements = htmlToElements;
exports.getCharacterImmediatelyAt = getCharacterImmediatelyAt;
exports.getCharacterImmediatelyBefore = getCharacterImmediatelyBefore;
exports.isNotDisplayed = isNotDisplayed;
exports.indexOf = indexOf;

});

//  LocalWords:  genericInsertIntoText endOffset endContainer mockup
//  LocalWords:  startOffset startContainer unlinks DOM gui Mangalam
//  LocalWords:  MPL Dubeau nextSibling versa insertFragAt validthis
//  LocalWords:  insertNodeAt jshint mergeTextNodes deleteNode dom lt
//  LocalWords:  lastChild prev getSelectionRange jQuery deleteText
//  LocalWords:  Prepend insertIntoText cd abfoocd abcd nodeToPath
//  LocalWords:  contenteditable pathToNode whitespace util jquery
//  LocalWords:  domutil
