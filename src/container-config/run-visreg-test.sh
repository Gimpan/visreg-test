#!/bin/bash

pretty_log() {
    echo -e "\x1b[2m$1\x1b[0m"
}

PROJECT_ROOT="$(pwd)"

image_name=$1
shift # Remove the first argument (image_name) from the list of arguments

run_visreg_test() {
    exists=$(docker images -q $image_name 2> /dev/null)

    image_stale=false
    PREV_PACKAGEJSON="$PROJECT_ROOT/container/volumes/app/prev-package.json"
    # PREV_VISREG_CONFIG="$PROJECT_ROOT/container/volumes/app/prev-visreg.config.json"

    # If package.json has changed, we will need to rebuild the image
    if [[ ! -f $PREV_PACKAGEJSON ]] || [[ -f $PREV_PACKAGEJSON && ! -z "$(diff -q $PROJECT_ROOT/package.json $PREV_PACKAGEJSON 2>/dev/null)" ]]; then
        pretty_log "Package.json has changed (image will be rebuilt)"
        image_stale=true
    fi

    # Is this true? The config is mounted in the container, so shouldn't be needed:
    # # If visreg.config.json has changed, we will need to rebuild the image
    # if [[ ! -f $PREV_VISREG_CONFIG ]] || [[ -f $PREV_VISREG_CONFIG && ! -z "$(diff -q $PROJECT_ROOT/visreg.config.json $PREV_VISREG_CONFIG 2>/dev/null)" ]]; then
    #     pretty_log "Visreg.config.json has changed (image will be rebuilt)"
    #     image_stale=true
    # fi

    # If the image doesn't exist, or if it's outdated, build it
    if [ -z "$exists" ] || [ "$image_stale" == "true" ]; then
        pretty_log "Building the $image_name image..."
        SCRIPT_DIR="$(dirname "$0")"
        "$SCRIPT_DIR/build-visreg-test.sh" "$image_name" "$@"
    fi

    # Check if the container is running, and if so, stop it
    if [ "$(docker ps -q -f name=$image_name)" ]; then
        pretty_log "Stopping the previous container..."
        docker stop $image_name >/dev/null 2>&1
    fi

    # Remove the old container, if it exists
    if [ "$(docker ps -aq -f status=exited -f name=$image_name)" ]; then
        pretty_log "Removing the previous container..."
        docker rm $image_name >/dev/null 2>&1
    fi

    local env=$1
    local use_local_user=$2
    local VISREG_ARGS=$3

    # "Mirror" the project's
    #     - suites directory
    #     - package.json
    #     - visreg.config.json
    # These will be shared by both the npm package and the Docker container, enabling the user to run
    # the image from the Docker container with the same configuration as they would from the npm package

    # Mount for persistence - things only used by the container (stored in the "container" dir):
    #     - Cypress cache
    #     - node_modules (modules are installed based on the project's package.json, but they are distinct from
    #       the node_modules found in the project root, which are installed and used locally by the host machine.
    #       This allows for running visreg-test from the host machine outside of the container, and from the container,
    #       with the same configuration. 

    # if there's no visreg.config.json in the project root, create one:
    if [ ! -f "$PROJECT_ROOT/visreg.config.json" ]; then
        pretty_log "Creating a visreg.config.json file in the project root..."
        touch "$PROJECT_ROOT/visreg.config.json"
    fi

    # Run the container
    if [ $env = "dev" ]; then
        pretty_log "Running container (with mounted local dist folder)..."

        docker run --name $image_name -it \
        -e ENV=dev \
        -e ARGS=$VISREG_ARGS \
        -v "$PROJECT_ROOT"/suites:/app/suites \
        -v "$PROJECT_ROOT"/package.json:/app/package.json \
        -v "$PROJECT_ROOT"/tsconfig.json:/app/tsconfig.json \
        -v "$PROJECT_ROOT"/visreg.config.json:/app/visreg.config.json \
        -v "$PROJECT_ROOT"/container/volumes/app:/app \
        -v "$PROJECT_ROOT"/container/volumes/cypress-cache:/root/.cache/Cypress \
        -v "$PROJECT_ROOT"/../dist:/temp \
        -p 3000:3000 \
        -p 8080:8080 \
        $image_name
    else
        pretty_log "Running container..."

        if [ $use_local_user = true ]; then
            # For Windows users
            pretty_log "Using the local user's UID and GID in the container..."

            docker run --name $image_name -it \
            -u $(id -u):$(id -g) \
            -e ENV=prod \
            -e ARGS=$VISREG_ARGS \
            -v "$PROJECT_ROOT"/suites:/app/suites \
            -v "$PROJECT_ROOT"/package.json:/app/package.json \
            -v "$PROJECT_ROOT"/tsconfig.json:/app/tsconfig.json \
            -v "$PROJECT_ROOT"/visreg.config.json:/app/visreg.config.json \
            -v "$PROJECT_ROOT"/container/volumes/app:/app \
            -v "$PROJECT_ROOT"/container/volumes/cypress-cache:/root/.cache/Cypress \
            -p 3000:3000 \
            -p 8080:8080 \
            $image_name
        else
            docker run --name $image_name -it \
            -e ENV=prod \
            -e ARGS=$VISREG_ARGS \
            -v "$PROJECT_ROOT"/suites:/app/suites \
            -v "$PROJECT_ROOT"/package.json:/app/package.json \
            -v "$PROJECT_ROOT"/tsconfig.json:/app/tsconfig.json \
            -v "$PROJECT_ROOT"/visreg.config.json:/app/visreg.config.json \
            -v "$PROJECT_ROOT"/container/volumes/app:/app \
            -v "$PROJECT_ROOT"/container/volumes/cypress-cache:/root/.cache/Cypress \
            -p 3000:3000 \
            -p 8080:8080 \
            $image_name
        fi
    fi
}

# Parse the arguments
container_args=()
env="prod"
use_local_user=false

for arg in "$@"
do
    if [[ $arg == *"="* ]]; then
        key=$(echo $arg | cut -f1 -d=)
        value=$(echo $arg | cut -f2 -d=)

        if [ "$key" = "--env" ]; then
            env=$value
        else
            container_args+=("$arg")
        fi
    else
        if [ "$arg" = "--use-local-user" ] || [ "$arg" = "-ulu" ]; then
            set -- "${@/--use-local-user/}" # Remove the --use-local-user argument from the arguments
            set -- "${@/-ulu/}" # Remove the -ulu argument from the arguments
            use_local_user=true
        else 
            container_args+=("$arg")
        fi
    fi
done


# Join all container-args with a "=" (equals sign) - the plus sign is already 
# used as a separator for visreg-test arguments (e.g. --viewports=desktop+tablet+mobile)
VISREG_ARGS=$(printf "=%s" "${container_args[@]}")

run_visreg_test $env $use_local_user $VISREG_ARGS

