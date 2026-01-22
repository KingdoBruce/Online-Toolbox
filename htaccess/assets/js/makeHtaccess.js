let writetext = "";

/**
 * Main generator function
 */
function doAll() {
    writetext = `<Files ~ "^.(htaccess|htpasswd)$">\n    deny from all\n</Files>\n\n`;
    
    generateGlobalSettings();
    generatePasswordProtection();
    generateErrorPages();
    generateDefaultDocs();
    generateWWWRedirect();
    generatePageRedirects();
    generateAccessControl();
    generateMimetypes();
    generateHotlinking();
    
    const form = document.forms['htaccessform'];
    if (form && form['htaccess']) {
        form['htaccess'].value = writetext.trim();
    }
    return false;
}

/**
 * 1. Global Settings (Indexing & Caching)
 */
function generateGlobalSettings() {
    const form = document.forms['htaccessform'];
    
    // File List Indexing
    const fileList = form['file_list'].value;
    if (fileList === "true") {
        writetext += "Options +Indexes\n";
    } else if (fileList === "false") {
        writetext += "Options -Indexes\n";
    }

    // Image Caching
    const cacheVal = form['Pic_cache'].value;
    if (cacheVal && cacheVal.startsWith('t')) {
        const seconds = cacheVal.substring(1);
        writetext += `\n<FilesMatch ".(gif|jpg|jpeg|png|ico)$">\n    Header set Cache-Control "max-age=${seconds}"\n</FilesMatch>\n`;
    }
    writetext += "\n";
}

/**
 * 2. Directory Password Protection
 */
function generatePasswordProtection() {
    const path = document.forms['htaccessform']['sitePathPwd'].value;
    if (path) {
        writetext += `# Password Protection\n`;
        writetext += `AuthUserFile ${path}\n`;
        writetext += `AuthGroupFile /dev/null\n`;
        writetext += `AuthName "Please enter your ID and password"\n`;
        writetext += `AuthType Basic\n`;
        writetext += `require valid-user\n\n`;
    }
}

/**
 * 3. Error Pages
 */
function generateErrorPages() {
    const form = document.forms['htaccessform'];
    const errorCodes = [400, 401, 403, 404, 500, 503];
    let added = false;

    errorCodes.forEach(code => {
        const val = form[`error${code}`].value;
        if (val) {
            writetext += `ErrorDocument ${code} ${val}\n`;
            added = true;
        }
    });

    if (added) writetext += "\n";
}

/**
 * 4. Default Documents
 */
function generateDefaultDocs() {
    const form = document.forms['htaccessform'];
    let docs = [];
    for (let i = 1; i <= 8; i++) {
        const val = form[`extension${i}`].value;
        if (val) docs.push(val);
    }

    if (docs.length > 0) {
        writetext += `DirectoryIndex ${docs.join(' ')}\n\n`;
    }
}

/**
 * 5. WWW Unification
 */
function generateWWWRedirect() {
    const urlVal = document.forms['htaccessform']['unifiedURL'].value;
    if (urlVal && urlVal !== "http://" && urlVal !== "https://") {
        let unifiedURL = urlVal;
        if (!unifiedURL.endsWith('/')) unifiedURL += '/';
        
        const isSSL = unifiedURL.startsWith('https');
        const domainMatch = unifiedURL.match(/\/\/(www\.)?([^\/]+)/);
        if (domainMatch) {
            const domain = domainMatch[2];
            const escapedDomain = domain.replace(/\./g, '\\.');
            
            writetext += `RewriteEngine on\n`;
            if (urlVal.includes('//www.')) {
                // Redirect non-www to www
                writetext += `RewriteCond %{HTTP_HOST} ^${escapedDomain} [NC]\n`;
            } else {
                // Redirect www to non-www
                writetext += `RewriteCond %{HTTP_HOST} ^www\.${escapedDomain} [NC]\n`;
            }
            writetext += `RewriteRule ^(.*)$ ${unifiedURL}$1 [R=301,L]\n\n`;
        }
    }
}

/**
 * 6. Page Redirects
 */
function generatePageRedirects() {
    const form = document.forms['htaccessform'];
    
    // 301 Redirects
    for (let i = 1; i <= 3; i++) {
        const from = form[`redirectFrom${i}`].value;
        const to = form[`redirectTo${i}`].value;
        if (from && to) {
            writetext += `Redirect 301 ${from} ${to}\n`;
        }
    }

    // 302 Redirects
    for (let i = 1; i <= 2; i++) {
        const from = form[`redirect302From${i}`].value;
        const to = form[`redirect302To${i}`].value;
        if (from && to) {
            writetext += `Redirect 302 ${from} ${to}\n`;
        }
    }
    writetext += "\n";
}

/**
 * 7. Access Control
 */
function generateAccessControl() {
    const form = document.forms['htaccessform'];
    let allows = [];
    let denys = [];

    for (let i = 1; i <= 3; i++) {
        const a = form[`blockOK${i}`].value;
        const d = form[`blockNG${i}`].value;
        if (a) allows.push(a);
        if (d) denys.push(d);
    }

    if (allows.length > 0 || denys.length > 0) {
        writetext += `Order Deny,Allow\n`;
        denys.forEach(ip => writetext += `Deny from ${ip}\n`);
        allows.forEach(ip => writetext += `Allow from ${ip}\n`);
        if (allows.length > 0) writetext += `Deny from all\n`;
        writetext += "\n";
    }
}

/**
 * 8. MIME Types
 */
function generateMimetypes() {
    const form = document.forms['htaccessform'];
    for (let i = 1; i <= 2; i++) {
        const ext = form[`MIMEForm${i}`].value;
        const type = form[`MIME${i}`].value;
        if (ext && type) {
            writetext += `AddType ${type} ${ext.startsWith('.') ? ext : '.' + ext}\n`;
        }
    }
    writetext += "\n";
}

/**
 * 9. Image Hotlinking
 */
function generateHotlinking() {
    const form = document.forms['htaccessform'];
    const replaceUrl = form['Pic1'].value;
    
    if (replaceUrl) {
        writetext += `RewriteEngine on\n`;
        writetext += `RewriteCond %{HTTP_REFERER} !^$\n`;
        
        for (let i = 1; i <= 2; i++) {
            const domain = form[`PicForm${i}`].value;
            if (domain) {
                writetext += `RewriteCond %{HTTP_REFERER} !^http(s)?://(www\\.)?${domain.replace(/\./g, '\\.')} [NC]\n`;
            }
        }
        
        writetext += `RewriteRule .*\\.(gif|jpg|jpeg|bmp|png)$ ${replaceUrl} [R,NC,L]\n\n`;
    }
}