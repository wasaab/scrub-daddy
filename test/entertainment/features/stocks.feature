Feature: Handle Stocks Commands

    Scenario Outline: Invest in a stock
        Given I have <initialArmySize> soldiers in my army
        And 1 share of "TEST" stock costs "100.0000"
        When I call ".invest TEST <investShares>"
        Then I should have an army size of <finalArmySize>
        And I should have <finalShares> shares of "TEST" stock

    Examples:
        | investShares | finalShares | initialArmySize | finalArmySize |
        | 0            | 1           | 100             | 0             |
        | 1            | 1           | 100             | 0             |
        | 2            | 0           | 100             | 100           |
        | 2            | 2           | 300             | 100           |
        | 1.5          | 1           | 100             | 0             |
        |              | 1           | 12345           | 12245         |
        |              | 0           | 0               | 0             |
        | a            | 1           | 100             | 0             |
        | ^            | 1           | 100             | 0             |

    Scenario Outline: Invest Scrubbing Bubbles in a stock
        Given I have <initialArmySize> soldiers in my army
        And 1 share of "TEST" stock costs "100.0000"
        When I call ".invest-scrubbles TEST <scrubbles>"
        Then I should have an army size of <finalArmySize>
        And I should have <finalShares> shares of "TEST" stock

    Examples:
        | scrubbles    | finalShares | initialArmySize | finalArmySize |
        | 0            | 1           | 100             | 0             |
        | 99           | 0           | 100             | 100           |
        | 100          | 1           | 100             | 0             |
        | 200          | 2           | 300             | 100           |
        | 299          | 0           | 100             | 100           |
        |              | 0           | 12345           | 12345         |
        |              | 0           | 0               | 0             |
        | a            | 0           | 100             | 100           |
        | ^            | 0           | 100             | 100           |

    Scenario Outline: Sell shares of a stock
        Given I have <initialArmySize> soldiers in my army
        And 1 share of "TEST" stock costs "100.0000"
        When I call ".invest TEST <investShares>"
        And I call ".sell-shares TEST <sellShares>"
        Then I should have an army size of <finalArmySize>
        And I should have <finalShares> shares of "TEST" stock

    Examples:
        | investShares | sellShares  | finalShares     | initialArmySize | finalArmySize |
        | 1            | 1           | 0               | 100             | 100           |
        | 2            | 1           | 1               | 200             | 100           |
        | 2            | 2           | 0               | 400             | 400           |
        | 1            | 2           | 1               | 300             | 200           |
        | 1.5          | 1           | 0               | 200             | 200           |
        | 51           |             | 0               | 5200            | 5200          |
        | 51           | 41          | 10              | 5200            | 4200          |
        | 2            | 0           | 2               | 200             | 0             |
        | 2            | 1           | 0               | 0               | 0             |
        | 2            | a           | 0               | 200             | 200           |
        | 7            | ^           | 0               | 700             | 700           |
