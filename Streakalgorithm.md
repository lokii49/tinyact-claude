Streak algorithm:

Solo:

* If checkin is done +1 or else streak resets to 0 and if next day checkin is done the streak is 1.
* Example: present streak is 2 and checkin not done for today so streak resets to 0. Next day if checkin is done , 1 is the new streak.
* For renew of solo commitments, streak/checkin count/total checkins starts from 0 only just like new commitments.
* For extend of solo commitments, streak continues based on checkins done, nothing new.


Group with “All in for streaks”/accountable groups:

* If checkin is done by all existing group members then only streak increase to +1, or else everyone’s streak resets to 0 only.
* Example: present group streak is 2 and checkin not done for today by a member so streak resets to 0 for every one. Next day if checkin is done by everyone , 1 is the groups new streak.
* For renew of accountable groups, streak/checkin count/total checkins starts from 0 only just like new commitments.
* For extend of accountable groups, streak continues based on checkins done by all group members, nothing new.
* If userX is left/removed from group, the streak only depends on existing/remaining users.
* Example: group streak is 3 -> userX is left/removed, groups streak continues with 3 and based on existing user checkins it can increase or reset.


Group with no accountable partner/no group accountability:

* Each persons streak solely depends on their own checkins, if checkin is done for the day streak increases to +1, if not done streak resets to 0. 
* Example: present streak is 4 and checkin not done for today so streak resets to 0. Next day if checkin is done , 1 is the new streak.
* For renew of this groups, streak/checkin count/total checkins starts from 0 only just like new commitments.
* For extend of accountable groups, streak continues based on checkins done by each member, nothing new.
* If userX is left/removed from group, there is no impact on other users streak, they should continue as it is.
* Example: userX streak 2, userY streak 4, userZ is 2 -> userX is left/removed, userY streak continues with 3, userZ streak continues with 4.


Accountable partner:

* Both persons A and B in partnership:their streak depends on their two checkins (checkin of A and checkin of B for that day), if checkin is done by both users for the day streak increases to +1, if not done streak resets to 0. 
* Example: present partner streak is 3 and checkin not done for today by A, streak resets to 0 for both A and B. Next day if checkin is done by both , 1 is the partners new streak.
* For renew of this groups, streak/checkin count/total checkins starts from 0 only just like new commitments and no partnership details are shown after renewal, groups are completely new again.
* For extend of this groups, streak continues based on checkins done by each member/partner members, nothing new.
* If userX (un-partnered member) is left/removed from group, there is no impact on other users streak.
* Wrt partners A and B, if userA is left/removed at partner streak 3, userB should continue with 3, and then onwards userB streaks are solely dependent on himself only.
* Consider these wrt streak partnership (two people partners):
* If there is any accountable partnership between 2 users from day one/commitment creation day itself, then streak count should increase with both checkins and if any one person breaks it , then both users streak resets to 0. 
* If the grp commitment started and at the start there is no accountable partnership, streaks should count as per individuals checkins. Lets say if accountable partnership is created at later stage (ex: after 3 days) then the streak count continues from there, but if someone breaks both start from 0. Ex: userA has 3 streak and userB has 1 streak after 3 days of commitment start -> then accountable partner is made for A and B ->A continues with 3+ and B continues with 1+  if both checkins are done -> if someone broke the streak -> both start at 0 again.
* Lets say if partnership is ended, the both users must continue individually with their streaks from then onwards. Ex: userA and userB have 3 streaks with partnership -> end partnership -> userA 3+ and userB 3+ -> B did not checkin then B should start from 0 again, no impact on other users.
* Pause streak between partners:  Ex: userA  and userB has 3 streak after 3 days of commitment start with partnership -> then streak pause is done for 1 day -> both should continue with 3 after resume irrespective of A’s or B’s checkins. If paused for 1 day, streak should auto resume after 1 day.

