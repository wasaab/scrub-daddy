Feature: Gambling Command Handling

    Scenario Outline: Place clean bet
        Given I have <initialArmySize> soldiers in my army and others have <othersInitialArmySize>
        When I call ".clean <bet>"
        Then I should have an army size change of <armySizeChange>
        And others should have an army size of <othersInitialArmySize>

    Examples:
        | initialArmySize | bet  | armySizeChange  | othersInitialArmySize |
        |   1             | -1   | 0               | 5                     |
        |   1             | 0    | 0               | 5                     |
        |   1             | 1    | 1               | 5                     |
        |   100           | 40   | 40              | 5                     |
        |   0             | 1    | 0               | 4                     |
        |   13            | 12   | 12              | 4                     |
        |   1             | 1.5  | 0               | 4                     |
        |   1             | -0.1 | 0               | 4                     |
        |   1             | abc  | 0               | 4                     |

    Scenario Outline: Give soldiers to another user
        Given I have <initialArmySize> soldiers in my army and others have <othersInitialArmySize>
        When I call ".give <ammount> <@!<targetId>>"
        Then I should have an army size of <finalArmySize>
        And the user with id "<targetId>" should have an army size of <targetFinalArmySize>

    Examples:
        | initialArmySize | ammount  | finalArmySize   | targetId             |  othersInitialArmySize | targetFinalArmySize  |
        |   1             | -1       | 1               | 222222222222222222   |   5                    | 5                    |
        |   1             | 0        | 1               | 222222222222222222   |   5                    | 5                    |
        |   1             | 1        | 0               | 333333333333333333   |   5                    | 6                    |
        |   5             | 6        | 5               | 333333333333333333   |   5                    | 5                    |
        |   100           | 40       | 60              | 222222222222222222   |   5                    | 45                   |
        |   0             | 1        | 0               | 222222222222222222   |   1                    | 1                    |
        |   13            | 12       | 1               | 444444444444444444   |   1                    | 13                   |
        |   1             | 1.5      | 1               | 222222222222222222   |   1                    | 1                    |
        |   1             | -0.1     | 1               | 222222222222222222   |   1                    | 1                    |
        |   1             | abc      | 1               | 222222222222222222   |   1                    | 1                    |

    Scenario Outline: Discharge soldiers from my army
        Given I have <initialArmySize> soldiers in my army and others have <othersInitialArmySize>
        When I call ".discharge <ammount>"
        Then I should have an army size of <finalArmySize>
        And others should have an army size of <othersInitialArmySize>

    Examples:
        | initialArmySize | ammount  | finalArmySize   |  othersInitialArmySize |
        |   1             | -1       | 1               |   5                    |
        |   1             | 0        | 1               |   5                    |
        |   1             | 1        | 0               |   5                    |
        |   5             | 6        | 5               |   5                    |
        |   100           | 40       | 60              |   5                    |
        |   0             | 1        | 0               |   1                    |
        |   13            | 12       | 1               |   1                    |
        |   1             | 1.5      | 1               |   1                    |
        |   1             | -0.1     | 1               |   1                    |
        |   1             | abc      | 0               |   1                    |
