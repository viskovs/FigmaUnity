# Безопасность

## Модель доверия

Figma package считается недоверенным вводом до прохождения Unity validation.
Текущий bridge сохраняет его только в `Library`.

## Localhost Bridge

- listener привязан к `localhost:19783`;
- запрос дополнительно проверяется через `IPAddress.IsLoopback`;
- разрешены только `/health`, `/publish` и CORS preflight;
- максимальный размер запроса — 20 MB;
- entity ID очищается перед использованием в имени файла;
- входящие данные не интерпретируются как C# и не выполняются;
- Unity `Assets` не изменяется.

## Figma manifest

Network access ограничен:

```text
http://localhost:19783/
http://127.0.0.1:19783/
```

Плагин не отправляет данные во внешнюю сеть.

## Секреты

Не храните в репозитории:

- Figma Personal Access Token;
- GitHub token;
- Unity credentials;
- внутренние API keys;
- пользовательские абсолютные пути.

## Будущий compiler

Перед записью в `Assets` он должен:

- проверять schema и catalog version;
- запрещать path traversal;
- разрешать C# type только через catalog allowlist;
- проверять GUID и output paths;
- ограничивать asset size/type;
- показывать план изменений;
- выполнять сборку через Unity serialization API, а не текстовую модификацию prefab.

## Сообщение об уязвимости

До появления приватного security contact не публикуйте эксплуатационные детали в
issue. Свяжитесь с владельцем репозитория через доступный приватный канал GitHub.
