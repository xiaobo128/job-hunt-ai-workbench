## Environment

This repository is a WSL project.

Do not run Node.js, npm, pnpm, Git, or project scripts using Windows-native tools.

All project commands must be executed inside WSL.

Example:

wsl bash -lc "cd /home/rosbo/projects/job-hunt-ai-workbench && npm test"

The canonical project path is:

/home/rosbo/projects/job-hunt-ai-workbench

Windows may expose this repository as:

\\wsl.localhost\Ubuntu-22.04\home\rosbo\projects\job-hunt-ai-workbench

However, all project commands must use the WSL path:

/home/rosbo/projects/job-hunt-ai-workbench

Do not run commands from the Windows UNC path. Always `cd` into the canonical WSL path first.