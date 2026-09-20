import { Component, EventEmitter, Output, ViewChild, ElementRef, OnInit, AfterViewInit, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-startscreen',
  imports: [],
  templateUrl: './startscreen.html',
  styleUrl: './startscreen.scss',
})
export class Startscreen implements OnInit, AfterViewInit, OnDestroy {
  showSplash = signal(true);
  deleting = signal(false);
  letters = 'Sync & Work'.split('');

  /** Interne Liste aller aktiven Web-Animationen, um sie bei Bedarf vorzeitig abzubrechen. */
  private readonly animations: Animation[] = [];

  /** Event, das emittiert wird, sobald die Splash-Screen-Animation komplett beendet ist. */
  @Output() animationFinished = new EventEmitter<void>();

  @ViewChild('splashLogo') splashLogo!: ElementRef;
  @ViewChild('splashText') splashText!: ElementRef;
  @ViewChild('splashCenter') splashCenter!: ElementRef;

  /**
   * Lifecycle-Hook: Prüft beim Initialisieren, ob der Splash-Screen auf diesem Gerät / Browser bereits einmal abgespielt wurde.
   */
  ngOnInit() {
    const hasAnimated = localStorage.getItem('splashPlayed');
    if (hasAnimated) {
      this.showSplash.set(false);
      this.animationFinished.emit();
    }
  }

  /**
   * Lifecycle-Hook: Bricht alle verbleibenden Animationen ab, falls die Komponente vorzeitig zerstört wird.
   */
  ngOnDestroy() {
    this.animations.forEach(a => a.cancel());
  }

  /**
   * Lifecycle-Hook: Wartet, bis das Logo vollständig geladen ist, und startet dann zeitverzögert die Animation.
   * @returns - /
   */
  ngAfterViewInit() {
    if (!this.showSplash()) return;

    const img = this.splashLogo.nativeElement as HTMLImageElement;
    const start = () => setTimeout(() => this.startTransition(), 800);

    if (img.complete) {
      start();
    } else {
      img.addEventListener('load', start, { once: true });
    }
  }

  /**
   * Aktiviert den Ausblend-Status und startet die Kollaps-Animation des Textes.
   */
  startTransition() {
    this.deleting.set(true);
    this.collapseText();
  }

  /**
   * Animiert das Zusammenziehen des Textes über die Web Animations API. Schaltet im Anschluss das Logo-Fliegen ein.
   * @returns - /
   */
  collapseText() {
    if (!this.splashText) {
      this.startLogoTransition();
      return;
    }

    const textEl = this.splashText.nativeElement;
    const centerEl = this.splashCenter.nativeElement;
    const centerRect = centerEl.getBoundingClientRect();
    centerEl.style.width = `${centerRect.width}px`;

    const initialWidth = textEl.getBoundingClientRect().width;

    const textAnimation = textEl.animate(
      [
        { width: `${initialWidth}px` },
        { width: '0px' },
      ],
      {
        duration: 1750,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      }
    );

    textAnimation.onfinish = () => {
      textEl.style.display = 'none';
      this.startLogoTransition();
    };
  }

  /**
   * Berechnet den Pfad und animiert das Splash-Logo fließend an die finale Zielposition im Header der App.
   * @returns - /
   */
  startLogoTransition() {
    const headerLogoImg = document.querySelector(
      'app-header-public .header-logo-container img'
    ) as HTMLElement;

    if (!headerLogoImg || !this.splashLogo) {
      this.finishSplash();
      return;
    }

    const startRect = this.splashLogo.nativeElement.getBoundingClientRect();
    const targetRect = headerLogoImg.getBoundingClientRect();

    const deltaX = targetRect.left - startRect.left;
    const deltaY = targetRect.top - startRect.top;
    const scale = targetRect.width / startRect.width;

    const logoAnimation = this.splashLogo.nativeElement.animate(
      [
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})` },
      ],
      {
        duration: 1750,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards',
      }
    );

    this.animations.push(logoAnimation);

    logoAnimation.onfinish = () => {
      this.finishSplash();
    };
  }

  /**
   * Räumt alle Animationen auf, blendet den Splash-Screen aus, speichert den Status im LocalStorage und informiert das Eltern-Element.
   */
  finishSplash() {
    this.animations.forEach(a => a.cancel());
    this.animations.length = 0;

    this.showSplash.set(false);
    localStorage.setItem('splashPlayed', 'true');
    this.animationFinished.emit();
  }
}