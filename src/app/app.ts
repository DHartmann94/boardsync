import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Einstiegskomponente der BoardSync-Anwendung.
 * @class
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('boardsync');
}
