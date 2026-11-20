# PvP Tournament — Host Checklist

The host's step-by-step list for event day. Work from top to bottom and tick each box as you go. The rules behind each step are in [pvp-app.md](pvp-app.md), and deployment is in [pvp-deploy.md](pvp-deploy.md).

**How to read this list**

- Buttons are written with the Vietnamese label the host page shows by default, then the English label in brackets. The **VI / EN** switch at the top right changes the language.
- Sections marked with a player count apply only at that count. Everything else applies to every count.
- Repeat the group, semifinal and final sections for each series.

## At a glance

| Players | Groups | At the end of the group stage                                     | Series (expected games) | EasyPolls to post |
| ------- | ------ | ----------------------------------------------------------------- | ----------------------- | ----------------- |
| 21      | 7      | You pick 2 players who didn't win their group                     | 11 (about 34)           | 22                |
| 24      | 8      | You pick 1 player who didn't win their group                      | 12 (about 37)           | 24                |
| 27      | 9      | Nothing to pick: the 9 group winners go through                   | 13 (about 40)           | 26                |
| 30      | 10     | Survival game: the 3 weakest group winners play one game, 3rd is out | 15 (about 44)        | 29                |

- **Polls per series:** two for every group, semifinal and the final (who wins, and over/under games). The survival game has one ("who goes out?").
- **Over/under lines:** 2.5 games for groups and semifinals, 4.5 for the final. The app shows the line in the question, so just copy it.
- **Prizes:** the final's champion, runner-up and 3rd place (two runners-up and no 3rd if they're level on points in the final), and the top places of the **Bảng Thần Toán** (Oracle Ranking). A correct prediction scores 1 point in the group stage, 2 in the semifinals and 3 in the final. On the leaderboard, ties share a place, and places stop once three members hold one: two people sharing 1st plus one 2nd means there's no 3rd.

---

## 1. Days before the event

- [ ] The site is deployed and the host PIN works ([pvp-deploy.md](pvp-deploy.md), Phases 1–7). A rehearsal on a preview deployment (Phase 8) is recommended.
- [ ] The player count is decided: exactly **21, 24, 27 or 30**.
- [ ] You have every participant's **Discord username** (the unique @handle, not their server nickname).
- [ ] You have a few **reserves** lined up in case someone doesn't show up.
- [ ] The display-name JSON is ready: `{ "username": "Display name" }` for every participant, every reserve, and everyone likely to vote. Each name is 1–32 characters and unique (case and a leading emoji don't count as a difference).
- [ ] EasyPoll works in the Discord server, and [`easypoll-devtools.js`](../scripts/easypoll/easypoll-devtools.js) is at hand for exporting votes. It runs in Chrome's DevTools console, so a computer is the easiest scorekeeping device.

## 2. Setup

- [ ] Open `/host`, enter the PIN, press **Mở khóa** (Unlock).
- [ ] Type the event name in **Tên giải** (Event name), then **Lưu tên** (Save name).
- [ ] Paste the display-name JSON, then **Lưu N tên** (Save N names).
- [ ] Paste the participants' usernames, one per line, then **Lưu danh sách** (Save participants). Fix any red message first: wrong count, not a username, listed twice, or no display name yet.
- [ ] Check the **Sẽ hiện là** (Shown as) line: every name looks right.
- [ ] Press **Bốc thăm** (Draw groups). Viewers see the draw straight away. If needed, use **Bốc thăm lại** (Redraw groups), or tap a player and then a player in another group to swap them.
- [ ] Share the **viewer link** in Discord. Never share `/host` together with the PIN.
- [ ] Do a roll call. For anyone missing: **Công cụ BTC → Thay người** (Host tools → Replace a player), then pick their group, the missing player and a reserve. The rest of the draw stays as it is.
- [ ] Press **Bắt đầu vòng bảng** (Start group stage). The participant list is locked from here, but a reserve can still replace someone in a group that hasn't played.
- [ ] The top right says **Đã lưu mọi thay đổi** (All changes saved).

## 3. Group stage: repeat for every group

The groups are listed under the entry panel. Tap a card to select it; the next unfinished group is selected for you.

**Before the group plays**

- [ ] Post the winner poll: under **Dự đoán trên Discord** (Discord predictions) → **Ai thắng?** (Who wins?), copy the question, then each answer with its own **Copy** button, into a **non-anonymous** EasyPoll.
- [ ] Post the over/under poll the same way from **Kèo Trên/Dưới** (Over/under games). The line is 2.5.
- [ ] Press **Lên sóng** (Show as live) so viewers know who's up. Saving the first game also does this.
- [ ] Close both polls before game 1 starts. The app accepts votes at any time, so this is up to you.

Tip: every group is known once the group stage starts, so you can post the polls for the next few groups ahead of time.

**During**

- [ ] After each game: tap the winner, tap the runner-up (3rd place fills itself in), then **Lưu ván** (Save game).
  - Tapped the wrong player before saving: **Bỏ chọn** (Clear picks).
  - Saved the wrong game: **Hủy ván vừa lưu** (Undo last game).
- [ ] A player is absent or drops out mid-series: keep saving games with them in 3rd, or decide the group with **Công cụ BTC → BTC phân xử người thắng** (Override a series winner) and a short reason that viewers will see. An override voids that group's over/under votes.
- [ ] A player can't play and their group hasn't started: **Thay người** (Replace a player) with a reserve. That group's recorded polls are cleared, so post new ones.

**After**

- [ ] Export each poll's votes: in the EasyPoll dashboard, open the poll's votes page and paste `easypoll-devtools.js` into the Chrome DevTools console. It copies the votes JSON. If the votes span several pages, run it on each page.
- [ ] In the matching poll section, paste into **Nhập JSON phiếu bầu** (Import votes JSON), check the preview, then **Lưu N phiếu** (Save N votes). Do this for **both** polls.
- [ ] If the preview lists answers it couldn't match, check that the poll answers match the players' display names, then import again. A new import replaces the old one.
- [ ] Optional: **Công cụ BTC → Ai còn thiếu phiếu?** (Host tools → Who hasn't voted in every poll) lists everyone who skipped some of the recorded polls, with a bullet list of which ones. **Copy** next to the count copies a reminder for everyone; the **Copy** on each member copies just theirs, for a direct message.
- [ ] Optional: **Công cụ BTC → Người bầu chưa có tên hiển thị** (Host tools → Voters without a display name) lists voters who show up as bare usernames on the leaderboard. **Copy** the list to ask who they are, or press **Thêm N người vào danh sách tên hiển thị** (Add them to the display names) and rename them in **Tên hiển thị** (Display names).
- [ ] The group's card shows the winner and the vote percentages.

## 4. End of the group stage

When every group is decided, a **Vòng này đã xong!** (Stage complete) panel appears at the top.

The semifinal groups are drawn at random, and **only you see them until you start the semifinals**. Take your time with swaps; viewers won't see anything change.

### 21 or 24 players

- [ ] Pick who fills the empty semifinal spot (2 spots at 21 players, 1 at 24). Candidates are listed best record first. Each tap saves, and viewers see the pick. **Đổi** (Change) reopens the list.
- [ ] Press **Bốc thăm bán kết** (Draw the semifinal groups). Players from the same group are kept apart.
- [ ] Review the groups. Tap two players to swap them if needed; a **Tái đấu** (Rematch) note warns about players who already met in the group stage. **Bốc thăm lại** (Redraw) draws again and drops your swaps.
- [ ] Press **Bắt đầu bán kết** (Start the semifinals). It stays disabled until the pick and the draw are done. Viewers see the groups from now on.
- [ ] Backup: **Công cụ BTC → Tải JSON** (Host tools → Download JSON).

### 27 players

- [ ] Press **Bốc thăm bán kết** (Draw the semifinal groups).
- [ ] Review the groups and swap players if needed, or **Bốc thăm lại** (Redraw).
- [ ] Press **Bắt đầu bán kết** (Start the semifinals). Viewers see the groups from now on.
- [ ] Backup: **Tải JSON** (Download JSON).

### 30 players

- [ ] Check the list of the 10 group winners. The 3 players in the survival game are marked in red; a dashed border means tied for the last seat.
- [ ] If **Suất cuối trận sinh tử** (Last survival seat) is listed, press **Bốc thăm phân định** (Draw to break the ties).
- [ ] Press **Bắt đầu trận sinh tử** (Start the survival game).
- [ ] Backup: **Tải JSON** (Download JSON).

## 5. Survival game (30 players only)

**Before**

- [ ] Post the only poll for this game: **Ai bị loại?** (Who goes out?). There's no over/under poll.
- [ ] Press **Lên sóng** (Show as live). Close the poll before the game starts.

**During**

- [ ] It's a single game: tap the winner, tap the runner-up, then **Lưu ván** (Save game). 1st and 2nd go through, 3rd is out.
- [ ] Someone can't play: save the game with them in 3rd. This game takes no override and no replacement.

**After**

- [ ] Import the poll's votes JSON, then **Lưu N phiếu** (Save N votes).
- [ ] The panel says who's out and lists the 9 semifinalists.
- [ ] Press **Bốc thăm bán kết** (Draw the semifinal groups). Only you see the groups.
- [ ] Review the groups and swap players if needed, or **Bốc thăm lại** (Redraw).
- [ ] Press **Bắt đầu bán kết** (Start the semifinals). Viewers see the groups from now on.
- [ ] Backup: **Tải JSON** (Download JSON).

## 6. Semifinals: repeat for each of the 3

**Before**

- [ ] A semifinalist has to leave: use **Thay người** (Replace a player) before their semifinal starts. The first suggestion follows the rules; at 30 players it's usually the player the survival game knocked out.
- [ ] To move players between semifinals that haven't started, open **Đổi chỗ người chơi** (Rearrange players) under the list. A swap clears both semifinals' polls.
- [ ] Post the winner poll and the over/under poll (line 2.5).
- [ ] Press **Lên sóng** (Show as live). Close both polls before game 1.

**During**

- [ ] Save each game as in the group stage. Semifinals are first to 2, and an override works the same way.

**After**

- [ ] Import both polls' votes JSON and save them.

**When all 3 semifinals are done**

- [ ] The panel lists the 3 finalists. Press **Bắt đầu chung kết** (Start the grand final).
- [ ] Backup: **Tải JSON** (Download JSON).

## 7. Grand final

**Before**

- [ ] A finalist has to leave: use **Thay người** (Replace a player). The candidates are the other two players from their semifinal.
- [ ] Post the winner poll and the over/under poll (line **4.5**).
- [ ] Press **Lên sóng** (Show as live). Close both polls before game 1.

**During**

- [ ] First to 3, so 3 to 7 games. Save each game as before.

**After**

- [ ] Import both polls' votes JSON and save them.
- [ ] The panel says **X lên ngôi vô địch!** (X wins the tournament), followed by **Á quân** (Runner-up) and **Hạng ba** (Third place). Two runners-up means 2nd and 3rd were level on points, so both get the runner-up prize.
- [ ] Press **Bế mạc giải** (Finish the tournament). The champion banner with all three places stays on both pages.
- [ ] Backup: **Tải JSON** (Download JSON).

## 8. After the event

- [ ] Keep the final **Tải JSON** (Download JSON) file somewhere safe. It's the permanent record.
- [ ] Share the final **Bảng Thần Toán** (Oracle Ranking) from the viewer page with the guild. The prize places wear the seals 状元 (1st), 榜眼 (2nd) and 探花 (3rd); everyone else shows a plain number.
- [ ] Freeze the results with `READ_ONLY=1` ([pvp-deploy.md, Phase 10](pvp-deploy.md#phase-10--after-the-event)).
- [ ] Before the next event: remove `READ_ONLY`, redeploy, then **Công cụ BTC → Làm lại** (Host tools → Reset) and type `RESET`. The display names are kept.

---

## Throughout the event

- [ ] Keep an eye on the save status at the top right: **Đã lưu mọi thay đổi** (All changes saved). If it says **Chưa lưu** (Not saved), press **Thử lại** (Retry), and don't reload the tab until it saves.
- [ ] Use one scorekeeping device at a time. To switch, press **Khóa** (Lock) on the old one, then open `/host` on the new one.
- [ ] Don't push to `main` on event day: every push redeploys the live site.

## When something goes wrong

| Situation                                              | What to do                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved the wrong game                                   | **Hủy ván vừa lưu** (Undo last game) in that series                                                                                              |
| A wrong result in an earlier stage                     | **Công cụ BTC → Mở lại vòng trước** (Reopen previous stage). It deletes the current stage's series, with their results and polls. Fix the result, then advance again |
| A player is missing before their group plays           | **Thay người** (Replace a player) with a reserve                                                                                                   |
| A player is missing mid-series, forfeits or disconnects | Save games with them in 3rd, or **BTC phân xử người thắng** (Override a series winner) with a reason                                         |
| A survival game player is missing                      | Save the game with them in 3rd                                                                                                                     |
| A semifinalist or finalist leaves before their series  | **Thay người** (Replace a player); the suggested candidate is listed first                                                                         |
| The vote import can't match some answers               | The poll answers must match the display names. Fix the names (**Công cụ BTC → Tên hiển thị**, Display names) or the poll, then import again        |
| A voter shows as a username on the leaderboard         | Add them to the display names. Paste the full list: saving replaces it                                                                             |
| Red banner: another tab saved a newer version          | The newer version was loaded. Redo your last change                                                                                                |
| You need an earlier state back                         | **Công cụ BTC → Khôi phục bản lưu cũ** (Restore an earlier save) → **Xem các bản lưu** (Load saves) → **Khôi phục** (Restore)                      |
| You're sent back to the PIN screen                     | The PIN was changed on Vercel. Enter the new one                                                                                                   |
