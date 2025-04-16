## FIAP Hackaton 8SOAT - Grupo 04 - Microserviço de conversão de vídeos

## Objetivo

Este microserviço tem como objetivo realizar as conversões de videos em imagens. Ele recebe as mensagens publicadas em uma fila do recurso SQS da AWS com as solicitações de conversão de vídeos publicas pelo microserviço `hackaton-api`. Depois de recebidas as mensagens, ele realiza a consulta dos vídeos no recurso AWS S3, realiza a conversão desses em imagens, cumprime em um arquivo, armazena esse no recurso AWS S3 e requisita o microserviço `hackaton-api` para notificar o status da conversão de cada vídeo.

## Requerimentos
- Node 20 e Typescript;
- Docker e docker compose;
- Conta AWS Academy;
- Acesso as configurações do repositório no Git Hub.

## Execução

Para realizar a execução local ou via cloud AWSm siga a seguinte documentação [Execução do serviço](./docs/RUN_CONFIGURATION.md) 

## Arquitetura do Sistema

Para saber mais detalhes sobre a arquitetura do sistema que esse serviço faz parte acesse a documentação [Arquitetura do Sistema](./docs/SYSTEM_ARCHITECTURE.md)

## Participantes

- Amanda Maschio - RM 357734
- Jackson Antunes - RM357311
- Lucas Accurcio - RM 357142
- Vanessa Freitas - RM 357999
- Winderson Santos - RM 357315
