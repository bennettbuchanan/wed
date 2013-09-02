Only salient changes are recorded here.

* 0.9.0:

  - GUI: Wed now actually uses the icons set on actions.

  - API: ``Editor.{get,set}CaretAsPath`` were not used anywhere and
    thus were removed.

  - API: ``Editor.{get,set}DataCaretAsPath`` were only used by
    wundo.js and thus removed from the ``Editor`` API and moved to
    wundo.

  - API: ``Editor.getDataCaret`` and ``Editor.toDataCaret`` are now
    able to return approximate positions when the GUI caret happens to
    be in a position for which there is no corresponding data caret.

  - A few deal-breaker bugs were fixed. They were major enough to
    require a new release, but the changes above required a minor
    release rather than a patch release. Therefore, 0.9.0 and not
    0.8.1.

* 0.8:

  - GUI: validation error reporting is more user friendly than it used
    to be.

  - API: Specifying a mode path can now be done in an abbreviated
    fashion for modes bundled with wed.

  - Internal: Now uses Bootstrap 3.0.0.

  - API: ``Decorator`` now takes the domlistener that listens
    to GUI changes, the editor, and the TreeUpdater that updates the
    GUI tree.  Consequently ``Mode.makeDecorator`` takes at the very
    least the same arguments. (It could require more if the mode
    requires it.)

  - API: modal callbacks are no longer called as ``callback(ev,
    jQthis)`` but as ``callback(ev)``.

  - API: ``Modal.getContextualActions`` takes two additional
    parameters to tell the mode where the editor is interested in
    getting actions.

* 0.7:

  - Wed gained saving and recovery capabilities.

  - Wed gained capabilities for logging information to a server
    through Ajax calls.

* 0.6:

  - Internal: wed no longer works with Twitter Bootstrap version 2 and
    now requires version 3 RC1 or later. This version of Bootstrap
    fixes some problems that recently turned out to present
    significant hurdles in wed's development. Unfortunately, version
    3's API is **very** different from version 2's so it is not
    possible to trivially support both versions.

  - GUI: Wed no longer uses glyphicons. Upon reviewing the glyphicons
    license, I noticed a requirement that all pages which use
    glyphicons contain some advertisement for glyphicons. I'm not
    going to require that those who use wed **pollute their web
    pages** with such advertisement.

  - GUI: Wed now uses Font Awesome.

  - API: ``Mode.getTransformationRegistry()`` is gone. Wed now
    gets a mode's actions by calling
    ``getContextualActions(...)``.

  - API: ``fireTransformation`` no longer accepts a
    new_caret_position.

  - API: transformations are now a special case of actions.

* 0.5 introduces major changes:

  - GUI: previous versions of wed had included some placeholders
    between XML elements so that insertion of new elements would be
    done by putting the caret into the placeholder and selecting the
    contextual menu. These placeholders proved unwieldy. Version 0.5
    removes these placeholders to instead have the contextual menu on
    starting and ending tags of elements serve respectively to add
    elements before and after an element.

  - Internal: wed now uses ``less`` to generate CSS.

  - Internal: wed now maintains two DOM trees representing the
    document. The first is a representation of the document's XML
    data. The second is an HTML-decorated representation of this same
    data for display purposes.

* 0.4 introduces major API changes:

  - Whereas the ``mode`` option used to be a simple path to the mode
    to load, it is now a simple object that must have the field
    ``name`` set to what ``mode`` used to be. See the Using_
    section.

.. _Using: README.html#using

  - Creating and initializing a wed instance has changed
    considerably. Instead of calling ``wed.editor()`` with appropriate
    parameters, the user must first issue ``new wed.Editor()`` without
    parameters and then call the ``init()`` method with the parameters
    that were originally passed to the ``editor()`` function. See the
    `Using`_ section for the new way to create an editor.

..  LocalWords:  API CaretAsPath DataCaretAsPath wundo js toDataCaret
..  LocalWords:  getDataCaret domlistener TreeUpdater makeDecorator
..  LocalWords:  ev jQthis getContextualActions wed's glyphicons CSS
..  LocalWords:  getTransformationRegistry fireTransformation init