package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@Controller
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    // ====================================
    // Startseite
    // ====================================

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("methods", EstimationMethod.values());
        model.addAttribute("methodLabels", Map.of(
                "FIBONACCI", "Fibonacci",
                "T_SHIRT", "T-Shirt Größen",
                "POWERS_OF_TWO", "Zweierpotenzen"
        ));
        return "index";
    }

    // ====================================
    // Abstimmungsraum
    // ====================================

    @GetMapping("/session/{roomCode}")
    public String session(@PathVariable String roomCode, Model model) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        model.addAttribute("session", session);
        model.addAttribute("roomCode", roomCode);
        model.addAttribute("estimationMethod", session.getEstimationMethod().name());
        model.addAttribute("participants", sessionService.getParticipants(roomCode));
        model.addAttribute("showTopic", session.isShowTopic());
        model.addAttribute("moderatorCanVote", session.isModeratorCanVote());
        model.addAttribute("autoReveal", session.isAutoReveal());
        return "session";
    }
}