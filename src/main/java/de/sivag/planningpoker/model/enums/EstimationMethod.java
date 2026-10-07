package de.sivag.planningpoker.model.enums;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

/**
 * Verfügbare Schätzmethoden für eine Planning-Poker-Session.
 * Jede Methode definiert ihr Kartendeck – Single Source für Template und Validierung.
 *
 * @author Nico Hoffmann
 * @version 1.1
 */
public enum EstimationMethod {
    FIBONACCI    ("1", "2", "3", "5", "8", "13", "21"),
    SCRUM        ("1", "2", "3", "5", "8", "13", "20", "40", "100"),
    T_SHIRT      ("XS", "S", "M", "L", "XL", "XXL"),
    POWERS_OF_TWO("1", "2", "4", "8", "16", "32", "64");

    private final List<String> cards;

    EstimationMethod(String... values) {
        // Jedes Deck beginnt mit: Unklar, Pause, Überspringen
        this.cards = Stream.concat(Stream.of("?", "☕", "-"), Arrays.stream(values))
                .toList();
    }

    public List<String> getCards() {
        return cards;
    }

    public boolean isValidCard(String value) {
        return cards.contains(value);
    }
}
