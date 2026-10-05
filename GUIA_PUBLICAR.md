# Publicar engram-analitica.com y la landing del QR — guía paso a paso

*Todo desde el navegador, sin terminal, salvo el último bloque (repositorio del código).*
*Tiempo: 40 minutos de trabajo + hasta 24 h de espera para el certificado HTTPS. Hazlo hoy; el 15 está a doce días.*

## 0. Antes de subir: tres huecos por llenar en los archivos

Abre con un editor de texto (Bloc de notas sirve; mejor VS Code):

1. `conpapa/index.html` → busca `REEMPLAZAR` dos veces:
   - el enlace del **formulario** "Quiero el reporte de mi región" (ver paso 4),
   - tu **LinkedIn**.
2. `index.html` → `REEMPLAZAR` una vez: tu LinkedIn. Y la foto: el recuadro "Fotografía de Lucas" se cambia por `<img src="lucas.jpg" ...>` cuando la tengas (súbela junto a los demás archivos).
3. `conpapa/Charla_CONPAPA_DatoEsDato.pdf` → **reemplázalo** por tu deck final exportado a PDF desde PowerPoint (Archivo → Exportar → PDF), con ese mismo nombre.

## 1. GitHub: el repositorio que sirve el sitio (10 min)

1. Entra a github.com con tu cuenta (`lucasbayones`) → botón **New repository**.
2. Nombre **exactamente**: `lucasbayones.github.io` · Public · sin README (ya traes uno) → **Create repository**.
3. En la página vacía del repo: **uploading an existing file** → arrastra **el contenido** de la carpeta descomprimida (`index.html`, `CNAME`, `.nojekyll`, `README.md` y la carpeta `conpapa` completa). GitHub acepta arrastrar carpetas.
4. Abajo, **Commit changes**.
5. Settings → **Pages** (menú izquierdo): *Source: Deploy from a branch* · *Branch: main* · */ (root)* → **Save**.

En dos minutos, `https://lucasbayones.github.io/` muestra el sitio y `https://lucasbayones.github.io/conpapa/` la landing. **Pruébalo ahora**: el QR impreso ya funciona desde este momento, con dominio o sin él.

## 2. GoDaddy: apuntar el dominio a GitHub (10 min)

GoDaddy → *Mis productos* → junto al dominio, **DNS** (o *Administrar DNS*):

1. Si existe un registro **A** con nombre `@` apuntando a una IP de GoDaddy ("Parked" o similar), **bórralo**. Si hay "Reenvío de dominio" activo, desactívalo.
2. **Agregar** cuatro registros **A**:
   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | A | @ | 185.199.108.153 | 1 hora |
   | A | @ | 185.199.109.153 | 1 hora |
   | A | @ | 185.199.110.153 | 1 hora |
   | A | @ | 185.199.111.153 | 1 hora |
3. **Agregar** un registro **CNAME**: Nombre `www` · Valor `lucasbayones.github.io` · TTL 1 hora. (Si ya existe un CNAME `www`, edítalo.)
4. Guarda. La propagación tarda de minutos a unas horas.

## 3. GitHub: activar el dominio y HTTPS (5 min + espera)

1. Repo → Settings → **Pages** → *Custom domain*: escribe `www.engram-analitica.com` → **Save**. GitHub comprueba el DNS (puede tardar unos minutos; si marca error, espera y vuelve a guardar).
2. Cuando aparezca la marca verde, activa **Enforce HTTPS** (la casilla se habilita cuando GitHub emite el certificado, hasta 24 h).
3. Verificación final: `https://www.engram-analitica.com/` muestra el sitio, `https://www.engram-analitica.com/conpapa/` la landing, `https://engram-analitica.com` redirige a www, y `https://lucasbayones.github.io/conpapa/` redirige al dominio.

**Red de seguridad para el 15:** si el 14 por la noche el dominio no funciona con HTTPS, borra el *Custom domain* en Settings → Pages. El QR impreso (`lucasbayones.github.io/conpapa/`) vuelve a servirse directo y la charla no depende del DNS.

## 4. El formulario "Quiero el reporte de mi región" (10 min)

forms.google.com → formulario en blanco. Título: *Reporte de temporada — piloto de productores*. Preguntas:
1. Nombre (texto corto)
2. Correo (texto corto) · 3. WhatsApp (texto corto, opcional)
4. Estado y zona donde produce (texto corto)
5. Cultivo (opción: Papa / Otro)
6. Hectáreas aproximadas (opción: <10 / 10–50 / 50–200 / >200)
7. ¿Lleva registro de siembra, aplicaciones y rendimiento por lote? (opción: Sí, en papel / Sí, en hoja de cálculo / Sí, en una plataforma / No todavía)
8. ¿Tiene estación meteorológica propia? (Sí / No)
9. ¿Quiere participar en el piloto (visita a lotes y reporte semanal gratuito)? (Sí / Solo el reporte regional)

Botón **Enviar** → icono de enlace → *Acortar URL* → copia el `https://forms.gle/…` y pégalo en `conpapa/index.html` donde dice `forms.gle/REEMPLAZAR`. Respuestas → icono de Sheets: cada respuesta es un lote potencial para el protocolo de Daniela.

## 5. El QR y la diapositiva 24

El QR actual codifica `https://lucasbayones.github.io/conpapa/` y funciona por redirección también con el dominio. Si quieres que el texto de la diapositiva muestre el dominio:
- cambia el texto bajo el QR a `engram-analitica.com/conpapa`;
- opcional, cuando el dominio ya responda con HTTPS: `python make_qr.py "https://www.engram-analitica.com/conpapa/"` y reemplaza la imagen. **No lo hagas antes de que el dominio funcione.**
- Ensayo del 12: escanear desde el fondo del salón con dos teléfonos.

## 6. El repositorio del código (privado) — en el RIG, 10 min

El código del sistema va a un repo **privado**, distinto del sitio. `.gitignore` ya excluye datos, salidas y la clave; añade antes las corridas y los registros:

```bash
cd ~/proyectos/agro-keynote
printf "runs/\nlogs_*.txt\ndata/sft/\n" >> .gitignore
sudo apt install -y git
git config --global user.name "Lucas Bayonés" && git config --global user.email "lucasbayones@gmail.com"
git init && git add . && git commit -m "agro-keynote: pipeline, reportes razonados, redes, app"
git branch -M main
```

En GitHub: **New repository** → nombre `agro-keynote` → **Private** → sin README → Create. Luego, en el RIG:

```bash
git remote add origin https://github.com/lucasbayones/agro-keynote.git
git push -u origin main
```

Pide usuario y contraseña: la contraseña es un **token** (GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic) → marca `repo` → copia). Después, en la Mac: `git clone https://github.com/lucasbayones/agro-keynote.git` y se acabaron los zips: cada cambio es `git pull`.

Comprobación antes del `push`: `git status` no debe listar `.env`, `data/`, `out/` ni `runs/`. Si aparece `.env`, **detente** y revisa `.gitignore`.
