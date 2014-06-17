Feature: tooltips are displayed on labels

Background: a simple document.
  Given a document with tooltips on
  And there are no tooltips

Scenario: a tooltip comes up when the user moves the mouse on a start label
  When the user moves the mouse over a start label
  Then a tooltip comes up

Scenario: a tooltip disappears when the user types ESCAPE
  When the user moves the mouse over a start label
  Then a tooltip comes up
  When the user types ESCAPE
  Then there are no tooltips
