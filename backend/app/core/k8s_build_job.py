from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

def _normalize_relative_path(path: str) -> str:
    if not path:
        return "."
    path = path.strip()
    if path in {"", "."}:
        return "."
    return path.lstrip("/")


def _build_context_path(repo_dir: str, context_path: str) -> str:
    rel = _normalize_relative_path(context_path)
    return repo_dir if rel in {"", "."} else f"{repo_dir}/{rel}"


def _build_dockerfile_path(repo_dir: str, dockerfile_path: str) -> str:
    if not dockerfile_path:
        return f"{repo_dir}/Dockerfile"
    dockerfile_path = dockerfile_path.strip()
    if dockerfile_path.startswith("/"):
        return dockerfile_path
    rel = _normalize_relative_path(dockerfile_path)
    if rel in {"", "."}:
        return f"{repo_dir}/Dockerfile"
    return f"{repo_dir}/{rel}"


def create_kaniko_job_manifest(
    job_name: str,
    namespace: str,
    git_repo_url: str,
    image_destination: str,
    context_path: str = ".",
    dockerfile_path: str = "Dockerfile",
    git_secret_name: Optional[str] = "portal-git-credentials",
    registry_secret_name: Optional[str] = "kaniko-registry-auth",
    repo_dir: str = "/workspace/repo",
    image_destinations: Optional[List[str]] = None,
    git_clone_script: Optional[str] = None,
    labels: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    destinations = image_destinations or [image_destination]
    context_dir = _build_context_path(repo_dir, context_path)
    dockerfile_full_path = _build_dockerfile_path(repo_dir, dockerfile_path)

    args = [
        f"--dockerfile={dockerfile_full_path}",
        f"--context=dir://{context_dir}",
    ]
    for dest in destinations:
        args.append(f"--destination={dest}")
    args.extend([
        "--cache=true",
        "--cache-run-layers=true",
        "--cache-copy-layers=true",
        "--compressed-caching=false",
    ])

    init_containers = []
    if git_clone_script:
        init_container_mounts = [
            {"name": "workspace", "mountPath": "/workspace"},
        ]
        volumes: List[Dict[str, Any]] = [
            {"name": "workspace", "emptyDir": {}},
        ]
        if git_secret_name:
            init_container_mounts.append({
                "name": "git-secret",
                "mountPath": "/etc/ssh-key",
                "readOnly": True,
            })
            volumes.append({
                "name": "git-secret",
                "secret": {"secretName": git_secret_name, "optional": False},
            })

        init_containers.append({
            "name": "git-clone",
            "image": "alpine/git:latest",
            "command": ["/bin/sh", "-c"],
            "args": [git_clone_script],
            "volumeMounts": init_container_mounts,
        })
    else:
        volumes = [{"name": "workspace", "emptyDir": {}}]

    kaniko_mounts = [
        {"name": "workspace", "mountPath": "/workspace"},
    ]

    if registry_secret_name:
        kaniko_mounts.append({
            "name": "registry-config",
            "mountPath": "/kaniko/.docker/",
        })
        volumes.append({
            "name": "registry-config",
            "secret": {"secretName": registry_secret_name},
        })

    kaniko_container = {
        "name": "kaniko",
        "image": "gcr.io/kaniko-project/executor:latest",
        "args": args,
        "volumeMounts": kaniko_mounts,
    }

    job_labels = {
        "app": "kaniko-build",
        "job-name": job_name,
    }
    if labels:
        job_labels.update(labels)

    job_manifest = {
        "apiVersion": "batch/v1",
        "kind": "Job",
        "metadata": {
            "name": job_name,
            "namespace": namespace,
            "labels": job_labels,
        },
        "spec": {
            "backoffLimit": 0,
            "ttlSecondsAfterFinished": 3600,
            "template": {
                "metadata": {
                    "labels": job_labels,
                },
                "spec": {
                    "restartPolicy": "Never",
                    "initContainers": init_containers,
                    "containers": [kaniko_container],
                    "volumes": volumes,
                },
            },
        },
    }

    return job_manifest


def extract_git_host(git_url: str) -> Optional[str]:
    if git_url.startswith("git@"):
        return git_url.split("@", 1)[1].split(":", 1)[0]
    if git_url.startswith("ssh://"):
        parsed = urlparse(git_url)
        return parsed.hostname
    if "://" in git_url:
        parsed = urlparse(git_url)
        return parsed.hostname or parsed.netloc
    return None


def extract_git_host_and_port(git_url: str) -> (Optional[str], Optional[int]):
    if git_url.startswith("ssh://"):
        parsed = urlparse(git_url)
        return parsed.hostname, parsed.port
    return extract_git_host(git_url), None


def create_git_clone_script(
    git_url: str,
    commit_sha: Optional[str] = None,
    branch: str = "main",
    repo_dir: str = "/workspace/repo",
    git_host: Optional[str] = None,
    git_port: Optional[int] = None,
) -> str:
    use_ssh = git_url.startswith("git@") or git_url.startswith("ssh://")
    if use_ssh and not git_host:
        git_host, git_port = extract_git_host_and_port(git_url)
    lines = ["set -e"]
    if use_ssh and git_host:
        lines.extend([
            "mkdir -p /root/.ssh",
            "cp /etc/ssh-key/id_rsa /root/.ssh/id_rsa",
            "chmod 600 /root/.ssh/id_rsa",
            f'export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_rsa -o StrictHostKeyChecking=no{f" -p {git_port}" if git_port else ""}"',
        ])

    lines.append("rm -rf /workspace/*")
    lines.append(f"git clone {git_url} {repo_dir}")
    lines.append(f"cd {repo_dir}")

    if commit_sha and commit_sha != "latest":
        commit_ref = commit_sha.replace('"', '\\"')
        lines.append(f'git checkout "{commit_ref}"')
    elif branch:
        branch_name = branch.replace('"', '\\"')
        lines.extend([
            f'if git show-ref --verify --quiet "refs/heads/{branch_name}"; then',
            f'  git checkout "{branch_name}"',
            f'elif git show-ref --verify --quiet "refs/remotes/origin/{branch_name}"; then',
            f'  git checkout -b "{branch_name}" "origin/{branch_name}"',
            "else",
            f'  echo "Branch {branch_name} not found, using default"',
            "fi",
        ])

    return "\n".join(lines)
