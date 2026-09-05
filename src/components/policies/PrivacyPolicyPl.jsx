import React from "react";

export default function PrivacyPolicyPl() {
  return (
    <div id="lang-pl" className="lang-section">
      <h1>Polityka prywatności Gramix</h1>
      <p className="updated"><em>Data ostatniej aktualizacji: kwiecień 2026 r.</em></p>
      <p>Dziękujemy za wybranie aplikacji <strong>Gramix</strong> („Aplikacja”, „my”, „nas”, „nasz”). Niniejsza Polityka prywatności wyjaśnia, jakie dane zbieramy, jak je wykorzystujemy i jakie prawa przysługują użytkownikowi. Przestrzegamy wymagań Ogólnego Rozporządzenia o Ochronie Danych (RODO).</p>
      
      <h2>1. Jakie dane zbieramy</h2>
      <h3>1.1 Dane konta</h3>
      <p>Aby korzystać z Aplikacji, rejestrujesz się za pomocą adresu e-mail i hasła. Zbieramy:</p>
      <ul>
        <li><strong>Adres e-mail</strong> — używany wyłącznie jako login. Nie wysyłamy wiadomości na ten adres, w tym potwierdzeń ani linków do resetowania hasła.</li>
        <li><strong>Hasło</strong> — przechowywane w postaci zaszyfrowanej. Odzyskiwanie hasła nie jest przewidziane; użytkownik sam odpowiada za bezpieczeństwo swoich danych logowania.</li>
      </ul>
      <p>Nie prosimy o podanie imienia ani innych identyfikatorów osobistych podczas rejestracji.</p>
      
      <h3>1.2 Potwierdzenie wieku i zgoda</h3>
      <p>Podczas rejestracji potwierdzasz, że masz ukończone 16 lat i akceptujesz niniejszą Politykę prywatności. Odnotowujemy fakt tego potwierdzenia, ale nie wymagamy dokumentów ani innych dowodów wieku.</p>
      
      <h3>1.3 Dane profilu (przechowywane na naszych serwerach i powiązane z kontem)</h3>
      <p>W celu obliczenia Twojej indywidualnej dziennej normy kalorii zbieramy:</p>
      <ul>
        <li>wiek;</li>
        <li>wagę;</li>
        <li>wzrost;</li>
        <li>płeć;</li>
        <li>wybrany cel (utrata wagi / utrzymanie wagi).</li>
      </ul>
      <p>Możesz w każdej chwili zmienić te dane w ustawieniach profilu.</p>
      
      <h3>1.4 Dziennik żywienia (przechowywany na naszych serwerach i powiązany z kontem)</h3>
      <ul>
        <li>nazwy potraw i składników, ich waga w gramach oraz obliczone wartości kalorii, białka, tłuszczów i węglowodanów dla każdego wpisu;</li>
        <li>data każdego wpisu.</li>
      </ul>
      
      <h3>1.5 Zdjęcia jedzenia (tymczasowe przechowywanie)</h3>
      <p>Kiedy robisz zdjęcie potrawy lub etykiety ze składem, obraz:</p>
      <ul>
        <li>jest wysyłany do API Google Gemini w celu rozpoznania jedzenia;</li>
        <li>jest przechowywany w Aplikacji przez 24 godziny, aby wyświetlał się wraz z wpisem w dzienniku;</li>
        <li>jest automatycznie i bezpowrotnie usuwany po upływie 24 godzin. Nie przechowujemy zdjęć dłużej niż ten okres.</li>
      </ul>
      
      <h3>1.6 Identyfikator techniczny</h3>
      <p>Używamy identyfikatora technicznego do zarządzania limitami zapytań API i zapewnienia stabilnego działania Aplikacji dla wszystkich użytkowników. Ten identyfikator nie jest używany do ustalenia Twojej tożsamości i nie jest udostępniany stronom trzecim.</p>
      
      <h2>2. Jak wykorzystujemy dane i na jakiej podstawie</h2>
      <h3>Zapewnienie dostępu do konta</h3>
      <p>Używamy podanego przez Ciebie adresu e-mail i hasła w celu Twojego uwierzytelnienia w Aplikacji.<br /><em>Podstawa prawna (art. 6 ust. 1 lit. b RODO): wykonanie umowy z użytkownikiem.</em></p>
      
      <h3>Obliczanie dziennej normy kalorii</h3>
      <p>Używamy danych profilu (wiek, waga, wzrost, płeć, cel), aby obliczyć Twoją indywidualną normę za pomocą wzoru i współczynników PAL.<br /><em>Podstawa: wykonanie umowy.</em></p>
      
      <h3>Analiza zdjęć i zapytań tekstowych</h3>
      <p>Wysyłamy Twoje zdjęcie lub opis tekstowy do API Google Gemini w celu identyfikacji produktów i uzyskania informacji o wartości odżywczej (kalorie, białko, tłuszcze, węglowodany, składniki).<br /><em>Podstawa: wykonanie umowy.</em></p>
      
      <h3>Przechowywanie i wyświetlanie dziennika żywienia</h3>
      <p>Przechowujemy Twoje wpisy i historię składników, aby umożliwić Ci przeglądanie kaloryczności potraw w ujęciu dziennym, tygodniowym, miesięcznym i rocznym.<br /><em>Podstawa: wykonanie umowy.</em></p>
      
      <h3>Zapobieganie nadużyciom i stabilność działania</h3>
      <p>Używamy identyfikatora technicznego do zarządzania obciążeniem i limitami zapytań.<br /><em>Podstawa (art. 6 ust. 1 lit. f RODO): prawnie uzasadniony interes administratora danych.</em></p>
      
      <h2>3. Twoje prawa wynikające z RODO</h2>
      <p>Przysługują Ci następujące prawa w odniesieniu do Twoich danych osobowych:</p>
      <ul>
        <li><strong>Prawo dostępu</strong> — możesz zażądać kopii swoich danych osobowych.</li>
        <li><strong>Prawo do sprostowania</strong> — możesz w dowolnym momencie zaktualizować dane profilu (wiek, waga, wzrost, płeć, cel) bezpośrednio w Aplikacji.</li>
        <li><strong>Prawo do usunięcia</strong> — możesz usunąć swoje konto i wszystkie powiązane z nim dane. Po usunięciu odzyskanie danych i korzystanie z tego konta nie jest możliwe. Archiwizujemy Twoje dane na okres 30 dni po usunięciu konta.</li>
      </ul>
      <p>Aby skorzystać z któregokolwiek z tych praw, skontaktuj się z nami pod adresem <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      
      <h2>4. Przekazywanie danych i usługi stron trzecich</h2>
      <h3>Google Gemini API</h3>
      <p>W celu analizy zdjęć i zapytań tekstowych przesyłane przez Ciebie treści są przekazywane do API Google Gemini. Google przetwarza te dane, aby zidentyfikować produkty spożywcze i zwrócić do Aplikacji informacje o wartości odżywczej. Nie przechowujemy Twoich zdjęć na naszych serwerach dłużej niż 24 godziny.</p>
      <p>Przetwarzanie przez Google podlega Polityce prywatności Google: <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">https://policies.google.com/privacy</a>. Należy pamiętać, że Google może przetwarzać te dane na serwerach poza Europejskim Obszarem Gospodarczym (EOG). W przypadku takich transferów stosowane są odpowiednie zabezpieczenia przewidziane przez RODO.</p>
      
      <h2>5. Bezpieczeństwo danych</h2>
      <p>Dane Twojego konta i dziennika żywienia są przechowywane na bezpiecznych serwerach. Hasła są przechowywane w postaci zaszyfrowanej. Stosujemy uzasadnione środki techniczne i organizacyjne w celu ochrony Twoich danych, jednak żadna metoda transmisji przez Internet nie może być absolutnie bezpieczna.</p>
      
      <h2>6. Okresy przechowywania</h2>
      <table>
        <thead>
          <tr>
            <th>Typ danych</th>
            <th>Okres przechowywania</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dane konta (e-mail, hasło)</td>
            <td>Do momentu usunięcia konta</td>
          </tr>
          <tr>
            <td>Dane profilu (wiek, waga, wzrost, płeć, cel)</td>
            <td>Do momentu usunięcia konta lub zmiany przez użytkownika</td>
          </tr>
          <tr>
            <td>Dziennik żywienia (potrawy, składniki, makroskładniki)</td>
            <td>Do momentu usunięcia konta</td>
          </tr>
          <tr>
            <td>Zdjęcia jedzenia</td>
            <td>24 godziny od przesłania, następnie automatycznie usuwane</td>
          </tr>
          <tr>
            <td>Identyfikator techniczny</td>
            <td>Tylko podczas aktywnej sesji</td>
          </tr>
        </tbody>
      </table>
      
      <h2>7. Dzieci</h2>
      <p>Aplikacja nie jest przeznaczona dla osób poniżej 16 roku życia. Podczas rejestracji prosimy o potwierdzenie, że masz ukończone 16 lat. Świadomie nie zbieramy danych osobowych dzieci. Jeśli uważasz, że dziecko zarejestrowało się w Aplikacji, skontaktuj się z nami pod adresem <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      
      <h2>8. Zmiany niniejszej Polityki</h2>
      <p>Od czasu do czasu możemy aktualizować niniejszą Politykę prywatności. Zaktualizowana wersja zostanie opublikowana na tej stronie. Zalecamy okresowe przeglądanie Polityki pod kątem zmian.</p>
      
      <h2>9. Kontakt i Administrator danych</h2>
      <p>W przypadku jakichkolwiek pytań dotyczących prywatności i ochrony danych, napisz do nas na adres <a href="mailto:caloriesnap26@gmail.com">caloriesnap26@gmail.com</a>.</p>
      <p>Administratorem danych Aplikacji Gramix jest:</p>
      <p>Imię i nazwisko: Roman Kharisov<br />Lokalizacja: Walencja, Hiszpania</p>
    </div>
  );
}