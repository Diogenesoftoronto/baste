{ pkgs, lib, ... }:
let
  task = description: exec: { inherit description exec; };
in
{
  dotenv.enable = true;
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    npm.enable = true;
  };
  packages = [ pkgs.curl ];

  tasks = {
    "baste:install" = task "Install both locked dependency trees" ''
      npm ci
      npm --prefix site ci
    '';
    "baste:api" = task "Run the local API" "npm run dev:api";
    "baste:site" = task "Run the website and Studio" "npm run dev:site";
    "baste:docs" = task "Serve documentation at /docs/" "node scripts/runtime.mjs docs";
    "baste:storybook" = task "Run component Storybook" "npm run dev:storybook";
    "baste:dev" = task "Start API and website together" "devenv up";
    "baste:build" = task "Build CLI and production website" ''
      npm run build
      npm --prefix site run build
    '';
    "baste:typecheck" = task "Typecheck CLI and website" ''
      npm run typecheck
      npm --prefix site run build.types
    '';
    "baste:lint" = task "Lint the Qwik website" "npm --prefix site run lint";
    "baste:test" = task "Run CLI/API and website tests" ''
      npm test
      npm --prefix site test
    '';
    "baste:storybook:build" = task "Build static Storybook" "npm --prefix site run build-storybook";
    "baste:check" = {
      description = "Run typechecks, lint and tests";
      after = [ "baste:typecheck" "baste:lint" "baste:test" ];
    };
  };

  process.manager.implementation = "native";
  processes.api = {
    exec = "npm run dev:api";
    ready = {
      exec = ''curl --fail --silent "http://127.0.0.1:''${BASTE_API_PORT:-3456}/api/health" >/dev/null'';
      initial_delay = 1;
      period = 1;
      timeout = 60;
    };
  };
  processes.site = {
    exec = "npm run dev:site";
    after = [ "devenv:processes:api@ready" ];
    ready = {
      exec = ''curl --fail --silent "http://127.0.0.1:''${BASTE_SITE_PORT:-5173}/" >/dev/null'';
      initial_delay = 1;
      period = 1;
      timeout = 60;
    };
  };
  # Storybook is available as a task; opt into supervising it alongside the app.
  processes.storybook = lib.mkIf (builtins.getEnv "BASTE_WITH_STORYBOOK" == "1") {
    exec = "npm run dev:storybook";
    ready = {
      exec = ''curl --fail --silent "http://127.0.0.1:''${BASTE_STORYBOOK_PORT:-6006}/" >/dev/null'';
      initial_delay = 1;
      period = 1;
      timeout = 60;
    };
  };
}
