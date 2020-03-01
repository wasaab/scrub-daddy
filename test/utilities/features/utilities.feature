Feature: Utility Command Handling

    Scenario Outline: Create and mention group of users
        Given there are 3 other members in my server
        When I call ".create-group <groupName> <@!<userId1>> <@!<userId2>>"
        And I call ".@<groupName> test"
        Then I should see a message with content "`@<groupName>` test <@!<userId1>> <@!<userId2>>"

    Examples:
        | groupName | userId1            | userId2             |
        | testGroup | 222222222222222222 | 333333333333333333  |
        | a1        | 444444444444444444 | 333333333333333333  |

    Scenario: Create and use a command alias
        Given I have 6 soldiers in my army and others have 1
        When I call ".alias drop discharge 5"
        And I call ".drop"
        Then I should have an army size of 1

    Scenario Outline: Get help documentation for a command
        Given the "inventory" command exists
        When I call ".<command> inventory"
        Then I should see a message with content "`to see your scrub box prize inventory.`"

    Examples:
        | command |
        | help    |
        | h       |