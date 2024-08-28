# Installation
<details>
    <summary>Windows</summary>

In your Windows Terminal (Powershell):
1. Install scoop
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```
2. Install bun & Node:
```
scoop install bun
scopo install node
```

3. Install rgl:
```
irm rgl.ink0rr.dev/install.ps1 | iex
```
</details>
<details>
<summary>MacOS</summary>

1. Install brew
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
2. Install bun & node
```
brew install bun
brew install node
```
3. Install rgl:
```
curl -fsSL rgl.ink0rr.dev/install.sh | sh
```
</details>

4. Install typing dependency (for auto complete):
```
bun i
```
5. Run rgl watch
```
rgl watch
```

# Creating new project
Just run
```
rgl init
```