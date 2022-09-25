## Example Projects
Example projects are provided here for your testing purposes. Simply fork this repository and kick off a build by pushing a tag like so:

```
$ git tag v0.0.1-test
$ git push --tags
```

The workflow is configured [here](../.github/workflows/build-example.yml).

If all goes well, executables will be attached as archives to your release.

## Godot 4
To test the godot 4 example, change the workflow by using the following build step:

```
- name: export game
  id: export
  uses: firebelley/godot-export@master
  with:
      godot_executable_download_url: https://downloads.tuxfamily.org/godotengine/4.0/beta1/Godot_v4.0-beta1_linux.x86_64.zip
      godot_export_templates_download_url: https://downloads.tuxfamily.org/godotengine/4.0/beta1/Godot_v4.0-beta1_export_templates.tpz
      relative_project_path: ./examples/project-godot-4 # build the godot 4 project
      relative_export_path: ./my/build/destination # move export output to this directory relative to git root
      archive_output: true
      wine_path: ${{ steps.wine_install.outputs.WINE_PATH }}
      use_godot_4: true

```