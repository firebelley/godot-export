# Godot Export
A workflow action to automatically export your Godot games. Supports standard and **Mono** builds!

## How it Works

### Automatic Exports
This action automatically reads your `export_presets.cfg` file to determine which builds to make. Whenever this action runs each of your defined exports will run. The resulting executables will be posted as zip files attached to the created release.

### Automatic Release
This action creates a release tagged with a [Semantic Version](https://semver.org/). The zip files containing the export results will be attached to this release. More info about releases can be found below.

## Configuration
### In Godot
Make sure that you have defined at least 1 export preset by going to `Project -> Export` in the Godot editor and creating a configuration. Also set the file name in the "Export Path" box. This action will not know how how to name your file without this. Notice how the below image has "win.exe" in the "Export Path" for my windows export. Your executables can be named however you like, as long as they include the appropriate extension `.exe`, `.x86_64`, etc.
![](docs/exports.png)

**NOTE**: The file extension for the Mac OSX export must be anything but `.zip` for versions of Godot before 3.2. If the Mac OSX export file extension is `.zip` for a Godot version earlier than 3.2, then your project source files will be exported instead of a Mac application. [This was a known issue with the Godot command line export](https://github.com/godotengine/godot/issues/23073). For reference, I used a `.z` file extension to make it work for my Mac OSX builds.

### Workflow
This action requires that your job utilizes Github's `actions/checkout@v1` so that the source code is available for Godot to export the game. See the below [example workflow configuration](#example-workflow-configuration) for an example.

### Environment Variables
Since this action creates releases and uploads the zip file assets, you will need to supply the `GITHUB_TOKEN` environment variable. For an example on how to do this, see the below [example workflow configuration](#example-workflow-configuration).


### Inputs
- `base_version` default `0.0.1`
    - The version which new releases start at. The first release will be this version. After that, releases will automatically be 1 patch version ahead of the version of the latest release. To increment minor and major versions simply set the `base_version` to reflect your desired major and minor versions. When the `base_version` is set to a higher version than the last release version, the `base_version` will be used.
- `godot_executable_download_url`
  - The **Linux Headless** version of Godot that you want to export your project with. For example, to use the current stable of version of Godot your value will be `https://downloads.tuxfamily.org/godotengine/3.1.2/Godot_v3.1.2-stable_linux_headless.64.zip`. If you do not use the Linux Headless version exporting will fail.
- `godot_export_templates_download_url`
  - The link to the `.tpz` archive of export templates. Can be found at `https://downloads.tuxfamily.org/godotengine`. The export templates must be for the same version of Godot that you are using in `godot_executable_download_url`. For example, the `godot_export_templates_download_url` that matches the `godot_executable_download_url` version is `https://downloads.tuxfamily.org/godotengine/3.1.2/Godot_v3.1.2-stable_export_templates.tpz`
- `godot_template_version`
  - A representation of the Godot version. For the above stable version, this value would be `3.1.2.stable`. For mono, it would be `3.1.2.stable.mono`. If you have templates installed on your local machine you can find this exact string by looking at your local templates directory:
    - `~/.local/share/godot/templates` for Linux
    - `%APPDATA%/Roaming/Godot/templates` for Windows
- `relative_project_path`
  - The relative path to the directory containing your `project.godot` file. If your `project.godot` is at the root of your repository then this value should be `./`. Do _not_ include `project.godot` as part of this path.
- `create_release` default `true`
  - Enable release creation. If `false`, exports will be available in folder `exports` in `relativeProjectPath`.

### Example Workflow Configuration
Below is a sample workflow configuration file utilizing this action. This example workflow would be defined in `.github/workflows/main.yml`. For more information about defining workflows [check out the workflow docs](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/configuring-a-workflow).

```yml
# Whenever a push is made to the master branch then run the job
on: 
  push:
    branches:
      - master

jobs:
  # job id, can be anything
  export_game:
    # Always use ubuntu-latest for this action
    runs-on: ubuntu-latest
    # Job name, can be anything
    name: Export Game Job
    steps:
      # Always include the checkout step so that 
      # your project is available for Godot to export
    - name: checkout
      uses: actions/checkout@v2.0.0
    - name: export game
      # Use version 1.0.0 (see releases for all versions)
      uses: firebelley/godot-export@v1.0.1
      with:
        # Defining all the required inputs
        # I used the mono version of Godot in this example
        godot_executable_download_url: https://downloads.tuxfamily.org/godotengine/3.2/beta4/mono/Godot_v3.2-beta4_mono_linux_headless_64.zip
        godot_export_templates_download_url: https://downloads.tuxfamily.org/godotengine/3.2/beta4/mono/Godot_v3.2-beta4_mono_export_templates.tpz
        godot_template_version: 3.2.beta4.mono
        relative_project_path: ./
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Tips
I recommend creating a separate branch just for the purposes of running this action. Suppose I want the action to run on `master` pushes, but I am in the middle of working on game-breaking changes. Rather than push directly to master and create broken builds (and releases) you might want to consider some different approaches:
  - You could create a `release` branch that this action runs on. Then merge your `master` branch into `release` whenever you want to generate a release.
  - You could keep `master` as your release-generating branch, and do active development on a `dev` branch. Merge `dev` into `master` when you want to create a release.

## Why?
Ultimately, I created this action for myself. I often want to test games on different devices, but I dread having to clone the repo, make sure I am on the correct version of Godot, get Mono setup, etc. I _could_ have generated builds myself and uploaded them to a file hosting site but that requires too much manual labor. Automation is much preferred!

Additionally, this solution makes it easier for me (and my friends) to play test. I can look back through any version. I can directly compare two versions side-by-side to see which version feels, looks, and plays better. 

The final thing that this action provides is a project history. Have you ever worked on a game over the course of several months, and forgot what it was like during the beginning? I personally never keep old builds around if I even generate them at all. If you work on a project long enough, it may be a hassle to generate a build at a certain point in time. Allowing builds to be automatically generated ensures that you have a timeline of evolution for your game.
