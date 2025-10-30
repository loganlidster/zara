#!/usr/bin/env python3
import requests
import json
import os
import time

# Get OAuth token from service account
def get_access_token():
    # Read service account key from environment or file
    service_account_key = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    if not service_account_key:
        print("Error: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set")
        return None
    
    key_data = json.loads(service_account_key)
    
    # Use the metadata server to get token (simpler approach)
    # Or use the service account to get token
    import google.auth
    import google.auth.transport.requests
    from google.oauth2 import service_account
    
    credentials = service_account.Credentials.from_service_account_info(
        key_data,
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )
    
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    
    return credentials.token

# Trigger Cloud Build
def trigger_build(project_id, repo_name, branch='main'):
    token = get_access_token()
    if not token:
        return None
    
    url = f'https://cloudbuild.googleapis.com/v1/projects/{project_id}/builds'
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    build_config = {
        'source': {
            'repoSource': {
                'projectId': project_id,
                'repoName': repo_name,
                'branchName': branch
            }
        },
        'steps': [
            {
                'name': 'gcr.io/cloud-builders/docker',
                'args': [
                    'build',
                    '-t', f'gcr.io/{project_id}/tradiac-api:latest',
                    '-f', 'api-server/Dockerfile',
                    '.'
                ]
            },
            {
                'name': 'gcr.io/cloud-builders/docker',
                'args': ['push', f'gcr.io/{project_id}/tradiac-api:latest']
            },
            {
                'name': 'gcr.io/google.com/cloudsdktool/cloud-sdk',
                'entrypoint': 'gcloud',
                'args': [
                    'run', 'deploy', 'tradiac-api',
                    '--image', f'gcr.io/{project_id}/tradiac-api:latest',
                    '--region', 'us-central1',
                    '--platform', 'managed',
                    '--allow-unauthenticated'
                ]
            }
        ],
        'timeout': '1200s'
    }
    
    response = requests.post(url, headers=headers, json=build_config)
    
    if response.status_code == 200:
        build = response.json()
        print(f"Build triggered successfully!")
        print(f"Build ID: {build['metadata']['build']['id']}")
        print(f"Status: {build['metadata']['build']['status']}")
        return build['metadata']['build']['id']
    else:
        print(f"Error triggering build: {response.status_code}")
        print(response.text)
        return None

if __name__ == '__main__':
    project_id = 'tradiac-testing'
    repo_name = 'github_loganlidster_zara'
    
    build_id = trigger_build(project_id, repo_name)
    
    if build_id:
        print(f"\nBuild started: https://console.cloud.google.com/cloud-build/builds/{build_id}?project={project_id}")