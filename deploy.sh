#!/bin/bash

# Criar o Namespace
kubectl apply -f deploy/kubernetes/config/namespace-config.yaml

# Criar a Secret e ConfigMap
kubectl apply -f deploy/kubernetes/config/secret-config.yaml
kubectl apply -f deploy/kubernetes/config/env-config.yaml

# Aplicar os Volumes
kubectl apply -f deploy/kubernetes/volume/volume-pv.yaml
kubectl apply -f deploy/kubernetes/volume/volume-pvc.yaml

# Rodar a API (Service, Deployment, e HPA)
kubectl apply -f deploy/kubernetes/api/api-service.yaml
kubectl apply -f deploy/kubernetes/api/api-deployment.yaml
kubectl apply -f deploy/kubernetes/api/api-hpa.yaml

echo "Deployment completo!"
