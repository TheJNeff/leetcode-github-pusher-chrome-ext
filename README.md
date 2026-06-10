Leetcode Integration with Github (LIG)

Chrome extension that allows users to seamlessly push leetcode solutions to GitHub. Now you can grind Leetcodes and cultivate your GitHub portfolio at the same time!

Setup:

Step 1: Download the extension and load into Chrome

1. Download the extension: `git clone https://github.com/TheJNeff/leetcode-github-pusher-chrome-ext.git`
2. open chrome and navigate to `chrome://extensions`
3. enable "Developer Mode"
4. select "Load Unpacked" and upload the `dist` folder

Step 2: Link extension to your Github repo:

1. Create a respository for your leetcode solutions
2. Navigate to `github.com/settings/personal-access-tokens/
3. Create a new fine-grained PAT with the following permissions on your repository:
    a. "Read access to metadata" (allows the extension to get the latest commit)
    b. "Read and write access to code" (allows the extension to diff your solution against the latest commit and push it)
4. Copy the token
5. Open the "LeetCode Github Pusher" extension in Chrome, navigate to settings, and fill out the forms for token, repo, and branch
6. (Optional) Pin the extension for ease of use

And you're ready to try it out!

Usage:

Open any problem on leetcode.com. You should see a "Push to Github" button added to the page by the extension. 

After submitting an accepted solution, click this button to stage your change. 

Open up the LGP extension. You can preview the commit and message before pushing it to Github. 