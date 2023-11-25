# LeetBattle
[LeetBattle](https://chromewebstore.google.com/detail/leetbattle/kidgeaockeleejmeogfcaodagaigllkp?hl=en "LeetBattle") is a chrome extension for LeetCode 1v1s to make DSA practice fun.

## Setup
1. Clone the develop branch
2. To setup the server, set the environment variable to 'development' and run the start script
```bash
cd api
export ENVIRONMENT=development
npm run begin
```
3. To setup the chrome extension, enable developer mode on the extensions hub, and load unpacked folder
[Link to steps](https://youtu.be/WC4KnbfMS9w "STEPS")

## Contributing
1. Clone the **develop** branch
2. Make your changes
3. Create a feature branch
```bash
git checkout -b update/description-of-change
```
4. Add your files, commit, and push
5. Create a pull request to merge your branch into develop

## TODO
- Perks - ways to make the game more engaging during the problem
	- some way to assess progress on question? like a progress bar which you can use to see how your opponent is doing
	- ways to sabotage your opponent? maybe once per game you can generate random chars in opponents code to hinder their progress
	- push notification when an opponent does something, like run a successful test, write x lines of code, etc.
- Option to rematch from chat room
- Script / scraper to constantly update CSV of LeetCode questions
- Ability to filter by topics, not just difficulty
- elo rating + leaderboard (may require implementing authentication)
