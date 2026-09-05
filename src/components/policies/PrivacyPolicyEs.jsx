import React from "react";

export default function PrivacyPolicyEs() {
  return (
    <div id="lang-es" className="lang-section">
      <h1>Política de privacidad de Gramix</h1>
      <p className="updated"><em>Fecha de última actualización: abril de 2026</em></p>
      <p>Gracias por elegir <strong>Gramix</strong> («Aplicación», «nosotros», «nos», «nuestro»). Esta Política de privacidad explica qué datos recopilamos, cómo los utilizamos y qué derechos tiene usted. Cumplimos los requisitos del Reglamento General de Protección de Datos (RGPD).</p>
      
      <h2>1. Datos que recopilamos</h2>
      <h3>1.1 Datos de cuenta</h3>
      <p>Para utilizar la Aplicación, usted se registra con una dirección de correo electrónico y una contraseña. Recopilamos:</p>
      <ul>
        <li><strong>Dirección de correo electrónico</strong> — se utiliza únicamente como inicio de sesión. No enviamos correos a esta dirección, incluidas confirmaciones ni recuperaciones de contraseña.</li>
        <li><strong>Contraseña</strong> — se almacena cifrada. No se ofrece recuperación de contraseña; usted es responsable de la seguridad de sus credenciales.</li>
      </ul>
      <p>No solicitamos su nombre ni otros identificadores personales en el registro.</p>
      
      <h3>1.2 Confirmación de edad y consentimiento</h3>
      <p>Al registrarse, usted confirma que tiene al menos 16 años y acepta esta Política de privacidad. Registramos el hecho de dicha confirmación, pero no solicitamos documentos ni otras pruebas de edad.</p>
      
      <h3>1.3 Datos de perfil (almacenados en nuestros servidores y vinculados a la cuenta)</h3>
      <p>Para calcular su norma calórica diaria individual, recopilamos:</p>
      <ul>
        <li>edad;</li>
        <li>peso;</li>
        <li>altura;</li>
        <li>sexo;</li>
        <li>objetivo elegido (pérdida de peso / mantenimiento).</li>
      </ul>
      <p>Puede modificar estos datos en cualquier momento en la configuración del perfil.</p>
      
      <h3>1.4 Diario de alimentación (almacenado en nuestros servidores y vinculado a la cuenta)</h3>
      <ul>
        <li>nombres de platos e ingredientes, su peso en gramos y los valores calculados de calorías, proteínas, grasas e hidratos de carbono por cada entrada;</li>
        <li>fecha de cada entrada.</li>
      </ul>
      
      <h3>1.5 Fotografías de alimentos (almacenamiento temporal)</h3>
      <p>Cuando fotografía un plato o una etiqueta nutricional, la imagen:</p>
      <ul>
        <li>se envía a la API de Google Gemini para el reconocimiento de alimentos;</li>
        <li>se almacena en la Aplicación durante 24 horas para mostrarse junto a la entrada del diario;</li>
        <li>se elimina automática e irrevocablemente tras 24 horas. No conservamos fotografías más allá de este plazo.</li>
      </ul>
      
      <h3>1.6 Identificador técnico</h3>
      <p>Utilizamos un identificador técnico para gestionar los límites de solicitudes a la API y garantizar el funcionamiento estable de la Aplicación para todos los usuarios. Este identificador no se utiliza para establecer su identidad y no se comparte con terceros.</p>
      
      <h2>2. Cómo utilizamos los datos y en qué base</h2>
      <h3>Acceso a la cuenta</h3>
      <p>Usamos su correo y contraseña para autenticarle en la Aplicación.<br /><em>Base jurídica (art. 6.1.b RGPD): ejecución de un contrato con el usuario.</em></p>
      
      <h3>Cálculo de la norma calórica diaria</h3>
      <p>Usamos los datos del perfil para calcular su norma individual mediante una fórmula y coeficientes PAL.<br /><em>Base: ejecución de un contrato.</em></p>
      
      <h3>Análisis de fotografías y solicitudes de texto</h3>
      <p>Enviamos su fotografía o descripción de texto a la API de Google Gemini para identificar productos y obtener información nutricional.<br /><em>Base: ejecución de un contrato.</em></p>
      
      <h3>Almacenamiento y visualización del diario</h3>
      <p>Almacenamos sus entradas e historial de ingredientes para que pueda consultar el contenido calórico por días, semanas, meses y años.<br /><em>Base: ejecución de un contrato.</em></p>
      
      <h3>Prevención de abusos y estabilidad del servicio</h3>
      <p>Usamos el identificador técnico para gestionar la carga y los límites de solicitudes.<br /><em>Base (art. 6.1.f RGPD): interés legítimo del responsable del tratamiento.</em></p>
      
      <h2>3. Sus derechos según el RGPD</h2>
      <p>Tiene los siguientes derechos con respecto a sus datos personales:</p>
      <ul>
        <li><strong>Derecho de acceso</strong> — puede solicitar una copia de sus datos personales.</li>
        <li><strong>Derecho de rectificación</strong> — puede actualizar los datos del perfil en cualquier momento directamente en la Aplicación.</li>
        <li><strong>Derecho de supresión</strong> — puede eliminar su cuenta y todos los datos asociados. Tras la eliminación no es posible recuperar los datos ni usar esa cuenta. Archivaremos sus datos durante 30 días tras la eliminación.</li>
      </ul>
      <p>Para ejercer cualquiera de estos derechos, contáctenos en <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      
      <h2>4. Transferencia de datos y servicios de terceros</h2>
      <h3>Google Gemini API</h3>
      <p>Para analizar fotografías y solicitudes de texto, el contenido que envía se transfiere a la API de Google Gemini. Google procesa estos datos para identificar alimentos y devolver información nutricional a la Aplicación. No almacenamos sus imágenes en nuestros servidores más de 24 horas.</p>
      <p>El tratamiento por Google se rige por la Política de privacidad de Google: <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">https://policies.google.com/privacy</a>. Google puede procesar estos datos en servidores fuera del Espacio Económico Europeo (EEE); en tales transferencias se aplican las salvaguardas correspondientes del RGPD.</p>
      
      <h2>5. Seguridad de los datos</h2>
      <p>Los datos de su cuenta y diario se almacenan en servidores seguros. Las contraseñas se almacenan cifradas. Aplicamos medidas técnicas y organizativas razonables para proteger sus datos; sin embargo, ningún método de transmisión por Internet puede garantizarse como completamente seguro.</p>
      
      <h2>6. Plazos de conservación</h2>
      <table>
        <thead>
          <tr>
            <th>Tipo de dato</th>
            <th>Plazo de conservación</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Datos de cuenta (correo, contraseña)</td>
            <td>Hasta la eliminación de la cuenta</td>
          </tr>
          <tr>
            <td>Datos de perfil (edad, peso, altura, sexo, objetivo)</td>
            <td>Hasta la eliminación de la cuenta o modificación por el usuario</td>
          </tr>
          <tr>
            <td>Diario de alimentación (platos, ingredientes, macros)</td>
            <td>Hasta la eliminación de la cuenta</td>
          </tr>
          <tr>
            <td>Fotografías de alimentos</td>
            <td>24 horas desde la carga, luego eliminadas automáticamente</td>
          </tr>
          <tr>
            <td>Identificador técnico</td>
            <td>Solo durante la sesión activa</td>
          </tr>
        </tbody>
      </table>
      
      <h2>7. Menores</h2>
      <p>La Aplicación no está destinada a personas menores de 16 años. Al registrarse le pedimos que confirme que tiene al menos 16 años. No recopilamos conscientemente datos de menores. Si cree que un menor se ha registrado, contáctenos en <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      
      <h2>8. Cambios en esta Política</h2>
      <p>Podemos actualizar esta Política de privacidad periódicamente. La versión actualizada se publicará en esta página. Recomendamos revisar la Política con regularidad.</p>
      
      <h2>9. Contacto y Responsable del tratamiento</h2>
      <p>Para cualquier consulta sobre privacidad y protección de datos, escríbanos a <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      <p>El responsable del tratamiento de la Aplicación Gramix es:</p>
      <p>Nombre: Roman Kharisov<br />Ubicación: Valencia, España</p>
    </div>
  );
}