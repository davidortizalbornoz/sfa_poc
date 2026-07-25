import { CitiesService } from './cities.service';
import { City } from './city.interface';
export declare class CitiesController {
    private readonly citiesService;
    constructor(citiesService: CitiesService);
    findAll(): City[];
}
