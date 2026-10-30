Feature: Example happy path
  As a {{persona}}
  I want {{capability}}
  So that {{outcome}}

  # Replace this file with real scenarios. Keep language testable and unambiguous.
  # Tag every scenario with a permanent criterion ID (@R-xx.y) — the gold thread.
  # Add a tier:high tag on the scenario line when full pipeline ceremony is required.
  # Vague words to avoid: fast, easy, secure, user-friendly, appropriately, etc.

  @R-00.1
  Scenario: Successful completion with valid input
    Given I am a {{persona}} on the {{page/start}}
    When I {{action}} with valid {{data}}
    Then I see {{specific observable result}}
    And {{system state that can be verified}}

  @R-00.2
  Scenario: Validation prevents incomplete submission
    Given I am on the {{form}}
    When I submit without {{required field}}
    Then I see an error associated with {{field}}
    And I remain on the form with my other input preserved
