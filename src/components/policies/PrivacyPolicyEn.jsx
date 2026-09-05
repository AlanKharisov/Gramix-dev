import React from "react";

export default function PrivacyPolicyEn() {
  return (
    <div id="lang-en" className="lang-section">
      <h1>Gramix Privacy Policy</h1>
      <p className="updated"><em>Last updated: April 2026</em></p>
      <p>Thank you for choosing <strong>Gramix</strong> ("App", "we", "us", "our"). This Privacy Policy explains what data we collect, how we use it, and what rights you have. We comply with the General Data Protection Regulation (GDPR).</p>
      
      <h2>1. Data We Collect</h2>
      <h3>1.1 Account data</h3>
      <p>To use the App you register with an email address and password. We collect:</p>
      <ul>
        <li><strong>Email address</strong> — used only as a login. We do not send emails to this address, including confirmations or password recovery.</li>
        <li><strong>Password</strong> — stored encrypted. Password recovery is not available; you are responsible for keeping your credentials safe.</li>
      </ul>
      <p>We do not ask for your name or other personal identifiers at registration.</p>
      
      <h3>1.2 Age confirmation and consent</h3>
      <p>At registration you confirm that you are at least 16 years old and accept this Privacy Policy. We record the fact of this confirmation but do not request documents or other proof of age.</p>
      
      <h3>1.3 Profile data (stored on our servers and linked to the account)</h3>
      <p>To calculate your individual daily calorie norm we collect:</p>
      <ul>
        <li>age;</li>
        <li>weight;</li>
        <li>height;</li>
        <li>sex;</li>
        <li>chosen goal (weight loss / maintenance).</li>
      </ul>
      <p>You can change this data at any time in the profile settings.</p>
      
      <h3>1.4 Food diary (stored on our servers and linked to the account)</h3>
      <ul>
        <li>names of dishes and ingredients, their weight in grams and calculated values for calories, protein, fat and carbohydrates per entry;</li>
        <li>date of each entry.</li>
      </ul>
      
      <h3>1.5 Food photos (temporary storage)</h3>
      <p>When you photograph a dish or a nutrition label, the image:</p>
      <ul>
        <li>is sent to the Google Gemini API for food recognition;</li>
        <li>is stored in the App for 24 hours to appear alongside the diary entry;</li>
        <li>is automatically and permanently deleted after 24 hours. We do not store photos beyond this period.</li>
      </ul>
      
      <h3>1.6 Technical identifier</h3>
      <p>We use a technical identifier to manage API request limits and ensure stable App operation for all users. This identifier is not used to establish your identity and is not shared with third parties.</p>
      
      <h2>2. How We Use Data and on What Basis</h2>
      <h3>Providing account access</h3>
      <p>We use your email and password to authenticate you in the App.<br /><em>Legal basis (Art. 6(1)(b) GDPR): performance of a contract with the user.</em></p>
      
      <h3>Calculating daily calorie norm</h3>
      <p>We use profile data (age, weight, height, sex, goal) to calculate your individual norm using a formula and PAL coefficients.<br /><em>Basis: performance of a contract.</em></p>
      
      <h3>Analysing photos and text requests</h3>
      <p>We send your photo or text description to the Google Gemini API to identify products and obtain nutritional information (calories, protein, fat, carbohydrates, ingredients).<br /><em>Basis: performance of a contract.</em></p>
      
      <h3>Storing and displaying the food diary</h3>
      <p>We store your entries and ingredient history so you can view the caloric content of dishes by day, week, month and year.<br /><em>Basis: performance of a contract.</em></p>
      
      <h3>Preventing abuse and ensuring stability</h3>
      <p>We use the technical identifier to manage load and request limits.<br /><em>Basis (Art. 6(1)(f) GDPR): legitimate interest of the data controller.</em></p>
      
      <h2>3. Your Rights under GDPR</h2>
      <p>You have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Right of access</strong> — you may request a copy of your personal data.</li>
        <li><strong>Right to rectification</strong> — you may update profile data (age, weight, height, sex, goal) at any time directly in the App.</li>
        <li><strong>Right to erasure</strong> — you may delete your account and all associated data. After deletion, recovery of data and use of that account is not possible. We will archive your data for 30 days after account deletion.</li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      
      <h2>4. Data Transfers and Third-Party Services</h2>
      <h3>Google Gemini API</h3>
      <p>To analyse photos and text requests, the content you submit is sent to the Google Gemini API. Google processes this data to identify food products and return nutritional information to the App. We do not store your images on our servers for more than 24 hours.</p>
      <p>Google's processing is governed by the Google Privacy Policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">https://policies.google.com/privacy</a>. Please note that Google may process this data on servers outside the European Economic Area (EEA). Appropriate GDPR safeguards apply to such transfers.</p>
      
      <h2>5. Data Security</h2>
      <p>Your account and food diary data are stored on secure servers. Passwords are stored encrypted. We apply reasonable technical and organisational measures to protect your data; however, no method of transmission over the Internet can be completely secure.</p>
      
      <h2>6. Retention Periods</h2>
      <table>
        <thead>
          <tr>
            <th>Data type</th>
            <th>Retention period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account data (email, password)</td>
            <td>Until account deletion</td>
          </tr>
          <tr>
            <td>Profile data (age, weight, height, sex, goal)</td>
            <td>Until account deletion or user change</td>
          </tr>
          <tr>
            <td>Food diary (dishes, ingredients, macros)</td>
            <td>Until account deletion</td>
          </tr>
          <tr>
            <td>Food photos</td>
            <td>24 hours from upload, then automatically deleted</td>
          </tr>
          <tr>
            <td>Technical identifier</td>
            <td>Active session only</td>
          </tr>
        </tbody>
      </table>
      
      <h2>7. Children</h2>
      <p>The App is not intended for persons under 16 years of age. At registration we ask you to confirm you are at least 16. We do not knowingly collect personal data of children. If you believe a child has registered in the App, contact us at <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      
      <h2>8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. The updated version will be published on this page. We recommend periodically reviewing the Policy for changes.</p>
      
      <h2>9. Contact and Data Controller</h2>
      <p>For any questions about privacy and data protection, write to us at <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      <p>The data controller for the Gramix App is:</p>
      <p>Name: Roman Kharisov<br />Location: Valencia, Spain</p>
    </div>
  );
}