Feature: Games Command Handling

    Scenario Outline: Get playtime of a game
        Given there are <numPlayers> other members in my server
        And no games have been played today
        When <numPlayers> players play <hours> hours of "<game>"
        And 1 players play 7 hours of "<game2>"
        And 1 players play 8 hours of "<game3>"
        And I call ".time <game>"
        Then I should see a message with field at index 0 named "<game>" and value "<totalHours>"

    Examples:
     | game     | game2    | game3       | hours | numPlayers  | totalHours |
     | -#$      | 123Abc   | test game   | 1.11  | 3           | 3.3        |
     | GAME 2   | GAME     | test game 2 | 2.0   | 3           | 6.0        |
     | test     | GAME 2   | 123Abc      | 0.33  | 3           | 1.0        |
     | 123Abc   | 123Abc2  | 123Abc 2    | 0.01  | 3           | 0.0        |
     | AbC      | abc      | aBc         | 0.02  | 3           | 0.1        |


    Scenario Outline: Get playtime of all games
        Given there are <numPlayers> other members in my server
        And no games have been played today
        When <numPlayers> players play <hours> hours of "<game>"
        And 1 players play 7 hours of "<game2>"
        And 1 players play 8 hours of "<game3>"
        And I call ".time"
        Then I should see a message with field at index 0 named "All Games" and value "<totalHours>"
        And I should see a message with field at index 1 named "<game3>" and value "8.0"
        And I should see a message with field at index 2 named "<game2>" and value "7.0"
        And I should see a message with field at index 3 named "<game>" and value "<gameHours>"

    Examples:
     | game     | game2    | game3       | hours | numPlayers  | gameHours  | totalHours |
     | -#$      | 123Abc   | test game   | 1.11  | 3           | 3.3        | 18.3       |
     | GAME 2   | GAME     | test game 2 | 2.0   | 3           | 6.0        | 21.0       |
     | test     | GAME 2   | 123Abc      | 0.33  | 3           | 1.0        | 16.0       |
     | 123Abc   | 123Abc2  | 123Abc 2    | 0.01  | 3           | 0.0        | 15.0       |
     | AbC      | abc      | aBc         | 0.02  | 3           | 0.1        | 15.1       |


    Scenario Outline: Get user's playtime of a game after opting into tracking
        Given there are <numPlayers> other members in my server
        And no games have been played today
        And no users have opted into playtime tracking
        When <numPlayers> players play <hours> hours of "<game>"
        And I call ".opt-in"
        And I call ".time <game> <@!<targetId>>"
        Then I should see a message with field at index 0 named "<game>" and value "<totalHours>"

    Examples:
        | game        | hours | numPlayers  | targetId           | totalHours |
        | test game   | 1.11  | 3           | 111111111111111111 | 1.1        |
        | test game 2 | 2.0   | 3           | 111111111111111111 | 2.0        |
        | 123Abc      | 0.33  | 3           | 111111111111111111 | 0.3        |
        | 123Abc 2    | 0.01  | 3           | 111111111111111111 | 0.0        |
        | 2           | 0.05  | 3           | 111111111111111111 | 0.1        |

    Scenario Outline: Attempt to get user's playtime of a game without opting into tracking
        Given there are <numPlayers> other members in my server
        And no games have been played today
        And no users have opted into playtime tracking
        When <numPlayers> players play <hours> hours of "<game>"
        And I call ".time <game> <@!<targetId>>"
        Then I should see a message with content "I do not track that scrub's playtime."

    Examples:
        | game        | hours | numPlayers  | targetId           |
        | test game   | 1.0   | 3           | 111111111111111111 |
        | test game 2 | 1.0   | 3           | 222222222222222222 |