# Godot Export
A workflow action to automatically export your Godot games. Supports standard and **Mono** builds!

## Contents
- [How it works](#how-it-works)
- [Setting Up Export Presets](#setting-up-export-presets)
- [Workflow Configuration](#workflow-configuration)
  - [Example Configuration](#example-configuration)
  - [Mono Builds](#mono-builds)
  - [Android Builds](#android-builds)
- [Custom Editor Settings](#custom-editor-settings)
- [Tips](#tips)
  - [Using tag pushes](#using-tag-as-base_version)
  - [Supply custom editor settings](#supplying-a-custom-editor-settings-file)

## How it Works

### Automatic Exports
This action automatically reads your `export_presets.cfg` file to determine which builds to make. Whenever this action runs each of your defined exports will run. The resulting executables will be posted as zip files attached to the created release.

### Automatic Release
This action creates a release tagged with a [Semantic Version](https://semver.org/). The zip files containing the export results will be attached to this release. More info about releases can be found below.

## Setting Up Export Presets
Define at least 1 export preset by going to `Project -> Export` in the Godot editor and creating a configuration. Set the file name in the "Export Path" box. This is how the action knows how to name your binary. Notice how the below image has "win.exe" in the "Export Path" for my windows export. Your executables can be named however you like, as long as they include the appropriate extension `.exe`, `.x86_64`, etc.
![](docs/exports.png)

**NOTE**: The file extension for the Mac OSX export must be anything but `.zip` for versions of Godot before 3.2. If the Mac OSX export file extension is `.zip` for a Godot version earlier than 3.2, then your project source files will be exported instead of a Mac application. [This was a known issue with the Godot command line export](https://github.com/godotengine/godot/issues/23073). For reference, I used a `.z` file extension to make it work for my Mac OSX builds.

## Workflow Configuration
### Inputs

#### Required Inputs
- `godot_executable_download_url`
  - The **Linux Headless** version of Godot that you want to export your project with. For example, to use the current stable of version of Godot your value will be `https://downloads.tuxfamily.org/godotengine/3.1.2/Godot_v3.1.2-stable_linux_headless.64.zip`. If you do not use the Linux Headless version exporting will fail.
- `godot_export_templates_download_url`
  - The link to the `.tpz` archive of export templates. Can be found at `https://downloads.tuxfamily.org/godotengine`. The export templates must be for the same version of Godot that you are using in `godot_executable_download_url`. For example, the `godot_export_templates_download_url` that matches the `godot_executable_download_url` version is `https://downloads.tuxfamily.org/godotengine/3.1.2/Godot_v3.1.2-stable_export_templates.tpz`.
- `relative_project_path`
  - The relative path to the directory containing your `project.godot` file. If your `project.godot` is at the root of your repository then this value should be `./`. Do _not_ include `project.godot` as part of this path.

#### Optional Inputs
- `export_debug` defaults `false`
  - If `true`, godot will export in debug mode.
- `archive_output` default `false`
  - If `true`, exported files will be archived into a `.zip` file.
- `relative_export_path` default `''`
  - If provided, exports will be moved to this directory relative to the root of the Git repository.
  - **NOTE**: This setting is overridden by `use_preset_export_path`
- `use_preset_export_path` default `false`
  - If set to true, exports will be moved to directory defined in `export_presets.cfg` relative to the root of the Git repository. Prioritized over `relative_export_path`.
- `wine_path` default `''`
  - The absolute path to the wine binary. If specified, Godot will use this to run rcedit to update Windows exe icons. See the [setup Windows icons](#setup-windows-icons) example configuration.
- `verbose` default `false`
  - If `true` will use the `--verbose` flag when exporting from Godot

### Environment Variables
Since this action creates releases and uploads the zip file assets, you will need to supply the `GITHUB_TOKEN` environment variable. For an example on how to do this, see the below [example workflow configuration](#example-configuration). This environment variable is not needed if you set `create_release` to `false`.

### Example Configuration
Below is a sample workflow configuration file utilizing this action. This example workflow could be defined in `.github/workflows/main.yml`. For more information about defining workflows see [the workflow docs](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/configuring-a-workflow).

This workflow will export your game, archive the files, and create a release containing the archives.

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
      uses: actions/checkout@v2.3.1
      # Ensure that you get the entire project history
      with:
        fetch-depth: 0
    - name: export game
      # Use latest version (see releases for all versions)
      uses: firebelley/godot-export@v3.0.0
      with:
        # Defining all the required inputs
        # I used the mono version of Godot in this example
        godot_executable_download_url: https://downloads.tuxfamily.org/godotengine/3.4.4/Godot_v3.4.4-stable_win64.exe.zip
        godot_export_templates_download_url: https://downloads.tuxfamily.org/godotengine/3.4.4/Godot_v3.4.4-stable_export_templates.tpz
        relative_project_path: ./
        archive_output: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    - name: create release
      # This release action has worked well for me. However, you can most likely use any release action of your choosing
      uses: softprops/action-gh-release@v0.1.14
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        generate_release_notes: true
        # Note that "~/.local/share/godot/builds" is the directory containing exported files by default
        files: |
          ~/.local/share/godot/builds/**/*
```

## Mono Builds
Mono builds do not require additional configuration. However, if you want to change the build tool that is used (currently defaults to `dotnet cli`) then you need to [supply your own editor settings](#custom-editor-settings) with the line `mono/builds/build_tool`. The value of this setting should be a number between `0` and `3`. This value corresponds to the build tool dropdown in the editor settings window at `Editor Settings -> Mono -> Builds -> Build Tool`. You can look at your local `editor_settings-3.tres` to see what this value should be if you want to match the build tool used during local development.

## Android Builds
For Android builds, use the [setup-android](https://github.com/android-actions/setup-android) action before this one in your workflow. [The default editor settings file](./dist/editor_settings-3.tres) used by this action already provides a default path to the Android SDK. If your path is different then [supply your own editor settings file](#custom-editor-settings).

## Custom Editor Settings
Some Godot configurations are editor-based and not project-based. This includes items like Android paths. This repository provides a [base editor settings](./dist/editor_settings-3.tres) that will be used by default when exporting your games. However, you can supply a custom editor settings configuration file by simply copying your custom editor settings file to `~/.config/godot/editor_settings-3.tres` _before_ this action runs. This action will not overwrite an existing `editor_settings-3.tres` file.

## Tips

### Using tag as base_version
You can use git tags to set the release version.
For example, using `git tag v1.0.0` and then `git push --tags` results in base-version 1.0.0 when using the following workflow.

```yml
# Whenever tag in the form of `v1.0.0` is pushed then run the job

on: 
  push:
    tags:
      - 'v*'

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
      uses: actions/checkout@v2.3.1
      # Ensure that you get the entire project history
      with:
        fetch-depth: 0
      # separate step to extract the version from the tag name
    - name: get tag from version
      id: tag_version
      run: |
        echo ::set-output name=TAG_VERSION::${GITHUB_REF#refs/tags/v}
    - name: export game
      # Use latest version (see releases for all versions)
      uses: firebelley/godot-export@v3.0.0
      with:
        # Defining all the required inputs
        # I used the mono version of Godot in this example
        godot_executable_download_url: https://downloads.tuxfamily.org/godotengine/3.3/rc9/mono/Godot_v3.3-rc9_mono_linux_headless_64.zip
        godot_export_templates_download_url: https://downloads.tuxfamily.org/godotengine/3.3/rc9/mono/Godot_v3.3-rc9_mono_export_templates.tpz
        relative_project_path: ./
        create_release: true
        base_version:  ${{ steps.tag_version.outputs.TAG_VERSION}} 
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Supplying a custom editor settings file
Include the following step before this action. For example:
```yml
# ...above this line is the workflow job setup
- name: use custom editor settings
  run: |
    mkdir -p ~/.config/godot
    cp ~/path/to/my/editor_settings-3.tres ~/.config/godot/
- name: export game
  uses: firebelley/godot-export@v3.0.0
  # ...the rest of the action config goes here
```

### Setup Windows Icons
In order to configure this action to update your game's Windows exe icon, include the following block before this action. Example:
```yml
- name: install wine
  id: wine_install
  run: |
    sudo apt install wine64
    echo ::set-output name=WINE_PATH::$(which wine64)
```
And then supply this `WINE_PATH` output to the `wine_path` input for this action:
```yml
- name: export game
  uses: firebelley/godot-export@v3.0.0
  with:
    # ... any other input configuration goes here in accordance with the documentation
    # 
    # read the wine path here that was an output of the wine_install step
    wine_path: ${{ steps.wine_install.outputs.WINE_PATH }}
