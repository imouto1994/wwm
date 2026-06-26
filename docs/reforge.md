## Where Winds Meet Reforge Mechs

- Reforge is a gacha system to improve the look of your weapon skin
- Your weapon skin has 5 nodes:
  - Node 1: Color Node
  - Node 2: 1st part of your weapon
  - Node 3: 2nd part of your weapon
  - Node 4: 3rd part of your weapon
  - Node 5: Highlight part of your weapon
- Each node has different values that will be randomized (gacha-ed) for each reforge attempt / roll
- There are basically 3 main tiers of the node value:
  - Gold Tier: Best tier with the best look
  - Purple Tier: Average tier with average look
  - Blue Tier: Low tier with normal look
- For Gold Tier, there are basically 2 sets for each weapon skin (Set A & Set B):
  - Node 2, Node 3, Node 5: They only have 2 variance for gold values aligning with Set A & Set B mentioned above.
  - Node 1 (Color Node): Color node will have around 10 variances for gold values. Among these variances, there will be 2 variances alignign with Set A & Set B mentioned above.
  - Node 5: The last node doesn't have purple or blue tiers. It means as long as you unlock this node, it will be permantently gold tier. Its gold tier also doesn't have variances. Instead, the gold value will just change depends on the state of the other 4 nodes. If all other 4 nodes have gold values of Set A, the value of the last node will also be set A. If all other 4 nodes have gold values of Set B, the value of the last node will also be set B. If the other 4 nodes don't fully match, the last node will just have a default gold value.
- The ideal goal is for us to roll all 5 nodes to have gold values and they're part of the same set (either set A or set B). However, some players might prefer to roll unique colors for the Color Node instead (the other 8 gold values of Node 1).
- Each node has its own separate pity tracking system. Each roll will increase the pity tracking of each node by 1.
- The hard pity to get gold value of a node is 90. However, based on our statistic, we will usually get gold value for a node when pity for that node reaches around 30-40.
- Pity for a node will be reset back to 0 after it gets gold value.
- Initially, only Node 1 is enabled. Other nodes are unlocked sequentially (Node 2, then 3, then 4, then 5) as you perform more and more rolls.
  - The total rolls needed to unlock each subsequent node **vary per weapon skin** - they are NOT universal. The values below were the originally-observed totals for one skin and are kept only as a rough reference:
    - Node 2: ~24 rolls
    - Node 3: ~40 total rolls
    - Node 4: ~70 total rolls
    - Node 5: ~99 total rolls
  - Because the totals differ per weapon, the tracker does not assume them: the player records an unlock manually when a node lights up in-game (see [reforge-app.md](reforge-app.md)).
- Pity of a node will only be tracked after it's enabled.
- You can always lock an enabled node so that a roll will not randomize its value. Once a node is locked, a roll will NOT increase its pity. If the node is unlocked again afterwards, the pity will be increased normally again after each roll. This is how players can keep the gold value of a node. It's nearly impossible to roll 4 gold values at once in 1 single roll.
- Cost of each roll varies based on number of locked nodes:
  - 0 Locked Node: 1 stone
  - 1 Locked Node: 2 stone
  - 2 Locked Nodes: 5 stones
  - 3 Locked Nodes: 10 stones
- Based on our statistics, we can confirm that for Node 1 (Color Node) to roll into the gold value of Set A / B, there needs to be first another node with gold value of that respective set first.
  - So either players have to be very lucky and get gold values for both Node 1 and another node in 1 roll then they can have a chance to get both nodes rolled into the gold values of a set at once.
  - Else, they have to first lock at least another node first with gold value of the set to fish for the gold value of that same set for Node 1 (Color node) in subsequent rolls.
- Users can also save the current state of their reforge into a plan. Then, they can continue with more rolls and then roll back to that saved plan afterwards if they're not satisfied. However, please NOTE that from our statistic, once players roll back to a saved plan, the pity of all nodes will be instantly resetted back to 0. So, the idea of pity stacking a node to save stones (by not locking any gold nodes and then roll back to the saved plan and lock the gold nodes again once the pity for the other nodes is high) is NOT feasible in this system.

## Reforge Strategy

Different players will have different desired look for their weapon skin when it comes to reforge. But the shared goal among all of these target looks is OBVIOUSLY minimizing the number of stones players will have to use to achieve the respective looks. As you can see, as we lock more nodes, the cost for each roll gets exponentially higher. Once you lock 3 nodes, each roll to randomize the last node costs 10 stones (10 times of a roll when no nodes are locked).

Henced, based on each target look, we need to have an optimal strategy by making use of all the known mechanics of reforge system we mentioned above to use as few stones as possible.

We will go through all common target looks and our proposed strategy for that target look.

#### Target Look 1: All nodes in the target set (Cost: $$$$$)

#### Target Look 2: Color node + 2 nodes in the target set (Cost: $$$$)

#### Target Look 3: Color node + 1 node in the target set (Cost: $$$)

#### Target Look 4: Color node in a target color not one of the 2 sets (Cost: $$ - $$$$$?)

#### Target Look 5: All gold nodes (Cost: $)
